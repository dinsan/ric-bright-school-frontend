import "server-only";

import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN, PICTURE_COUNT, PICTURE_KEYS, type ClassRoster } from "@/features/auth/contract";
import { fields } from "@/lib/forms/zod";
import { messages } from "@/lib/forms/messages";
import { audit } from "@/server/audit";
import { findUserByEmail, findUserById, findUserByUsername, normaliseEmail } from "@/server/accounts/queries";
import { getDb, isUniqueViolation, type UserRow } from "@/server/db";
import { fieldError, HttpError } from "@/server/http/errors";
import { enforceIpRateLimit, enforceRateLimit } from "@/server/http/rate-limit";
import { publicOrigin } from "@/server/http/request";
import { sendMail } from "@/server/mail";
import { emails } from "@/server/mail/templates";
import { checkSecondFactor } from "./mfa";
import { hashPassword, pictureSecret, verifyAgainstDummy, verifyPassword } from "./password";
import { deleteUserSessions } from "./session";
import {
  assertNotLocked,
  completeSignIn,
  PASSWORD_LOCKOUT,
  PICTURE_LOCKOUT,
  recordFailedSignIn,
  type SignInOutcome,
} from "./sign-in";
import { consumeToken, findToken, issueToken, recordTokenAttempt } from "./tokens";

/**
 * Signing up and signing in: every public /api/auth endpoint. Rules that protect accounts:
 * - No account enumeration: sign-up, "resend the link" and "forgot password" answer the same whether or
 *   not the email has an account; sign-in says "don't match" for both unknown emails and wrong passwords
 *   (with the same timing), and only reveals "confirm your email" or "turned off" after a correct password.
 * - Lockouts per account (10 wrong passwords, 5 wrong picture sets) plus per-IP rate limits.
 */

export const password = z
  .string({ error: messages.required("a password") })
  .min(PASSWORD_MIN, messages.tooShort(PASSWORD_MIN))
  .max(PASSWORD_MAX, messages.tooLong(PASSWORD_MAX));

const invalidCredentials = () => new HttpError(401, "invalid_credentials", "That email and password don't match. Check them and try again.");
const invalidLink = () => new HttpError(400, "invalid_token", "This link has expired or was already used.");

// --- Sign up ----------------------------------------------------------------------------------------

export const registerInput = z.object({
  role: z.enum(["parent", "teacher"], { error: messages.choose("parent or teacher") }),
  display_name: fields.text("your name", { max: 80 }),
  email: fields.email(),
  password,
  accept_terms: z.literal(true, { error: messages.accept("agree to the terms") }),
});

/**
 * Creates a parent or teacher account and emails a confirmation link. If the email already has an
 * account, that account's owner gets an email instead, and the answer is the same.
 */
export async function register(input: z.output<typeof registerInput>, request: Request) {
  await enforceIpRateLimit(request, "register", 20, 60 * 60);
  const origin = publicOrigin(request);
  const email = normaliseEmail(input.email);

  // Hash first, even when the email is taken: both answers then take the same time.
  const passwordHash = await hashPassword(input.password);
  const existing = await findUserByEmail(email);
  if (existing) {
    await notifyExistingAccount(email, origin);
    return;
  }

  let user: UserRow;
  try {
    // One INSERT per table, in one transaction (a nested create).
    user = await getDb().user.create({
      data: {
        role: input.role,
        displayName: input.display_name,
        email,
        passwordHash,
        language: "en",
        ...(input.role === "teacher" ? { teacherProfile: { create: {} } } : {}),
      },
    });
  } catch (error) {
    // Two sign-ups with the same email at once: the second one is "already has an account".
    if (isUniqueViolation(error)) return notifyExistingAccount(email, origin);
    throw error;
  }
  await sendVerificationEmail(user, origin);
}

async function notifyExistingAccount(email: string, origin: string) {
  try {
    await enforceRateLimit(`mail:exists:${email}`, 3, 60 * 60);
  } catch {
    return; // Quietly: the answer must not differ.
  }
  await sendMail(emails.accountExists(email, `${origin}/sign-in`, `${origin}/forgot-password`));
}

async function sendVerificationEmail(user: UserRow, origin: string) {
  if (!user.email) return;
  const { raw } = await issueToken("email_verification", { userId: user.id, data: { email: user.email } });
  await sendMail(emails.verifyEmail(user.email, user.displayName, `${origin}/verify-email?token=${encodeURIComponent(raw)}`));
}

export const tokenInput = z.object({ token: z.string().trim().min(1, messages.required("the link")).max(200) });

/**
 * Confirms an email address from the emailed link. Opening the link proves the person owns the address,
 * so they are signed in too, unless the account uses two-step verification (then they sign in normally).
 */
export async function verifyEmail({ token }: z.output<typeof tokenInput>, request: Request): Promise<SignInOutcome | null> {
  const row = await consumeToken("email_verification", token);
  if (!row?.userId) throw invalidLink();
  const user = await findUserById(row.userId);
  // The address changed since the link was sent: the link no longer applies.
  if (!user || user.email !== row.data.email) throw invalidLink();
  const verified = await getDb().user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });
  if (!verified.isActive || verified.mfaEnabledAt) return null;
  return completeSignIn(verified, request);
}

export const emailInput = z.object({ email: fields.email() });

export async function resendVerification({ email }: z.output<typeof emailInput>, request: Request) {
  await enforceIpRateLimit(request, "resend", 20, 60 * 60);
  const user = await findUserByEmail(email);
  if (!user || user.emailVerifiedAt || !user.isActive) return;
  try {
    await enforceRateLimit(`mail:verify:${user.id}`, 3, 60 * 60);
  } catch {
    return;
  }
  await sendVerificationEmail(user, publicOrigin(request));
}

// --- Sign in ----------------------------------------------------------------------------------------

export const loginInput = z.object({
  email: fields.email(),
  password: z.string().min(1, messages.required("your password")).max(PASSWORD_MAX),
});

/** Email + password (parents, teachers, admins). */
export async function login({ email, password }: z.output<typeof loginInput>, request: Request): Promise<SignInOutcome> {
  await enforceIpRateLimit(request, "login", 100, 10 * 60);
  const user = await checkPassword(await findUserByEmail(email), password);
  if (!user.emailVerifiedAt) {
    throw new HttpError(403, "email_not_verified", "Confirm your email address first. We sent you a link when you signed up.");
  }
  return completeSignIn(user, request);
}

export const usernameLoginInput = z.object({
  username: z.string().trim().toLowerCase().min(1, messages.required("your username")).max(30),
  password: z.string().min(1, messages.required("your password")).max(PASSWORD_MAX),
});

/** Username + password (students whose parent or teacher set one up). */
export async function loginWithUsername({ username, password }: z.output<typeof usernameLoginInput>, request: Request): Promise<SignInOutcome> {
  await enforceIpRateLimit(request, "login", 100, 10 * 60);
  let user: UserRow;
  try {
    user = await checkPassword(await findUserByUsername(username), password);
  } catch (error) {
    if (error instanceof HttpError && error.code === "invalid_credentials") {
      throw new HttpError(401, "invalid_credentials", "That username and password don't match. Check them and try again.");
    }
    throw error;
  }
  return completeSignIn(user, request);
}

/** Shared password check: same timing and answer for unknown accounts and wrong passwords. */
async function checkPassword(user: UserRow | null, password: string): Promise<UserRow> {
  if (!user?.passwordHash) {
    await verifyAgainstDummy(password);
    throw invalidCredentials();
  }
  assertNotLocked(user, PASSWORD_LOCKOUT);
  if (!(await verifyPassword(user.passwordHash, password))) {
    await recordFailedSignIn(user, PASSWORD_LOCKOUT);
    throw invalidCredentials();
  }
  if (!user.isActive) {
    throw new HttpError(403, "account_disabled", "This account is turned off. Ask your school or contact Lumina support.");
  }
  return user;
}

export const mfaInput = z.object({ code: z.string().trim().min(1, messages.required("the code")).max(32) });

const MFA_MAX_ATTEMPTS = 5;

/** The second step: a code from the authenticator app, or a recovery code. The step itself is a cookie. */
export async function completeMfa({ code }: z.output<typeof mfaInput>, challenge: string | undefined, request: Request): Promise<SignInOutcome> {
  const expired = () => new HttpError(401, "mfa_expired", "Your sign-in took too long. Start again.");
  await enforceIpRateLimit(request, "mfa", 50, 10 * 60);
  const token = await findToken("mfa_challenge", challenge);
  if (!token?.userId) throw expired();
  const user = await findUserById(token.userId);
  if (!user?.isActive || !user.mfaEnabledAt) throw expired();

  if (!(await checkSecondFactor(user, code))) {
    const attempts = await recordTokenAttempt(token.id, MFA_MAX_ATTEMPTS);
    if (attempts >= MFA_MAX_ATTEMPTS) throw new HttpError(401, "mfa_expired", "That was too many wrong codes. Start again.");
    throw fieldError("code", "That code didn't work. Check the app (or your recovery codes) and try again.", { code: "invalid_code" });
  }
  if (!(await consumeToken("mfa_challenge", challenge))) throw expired();
  return completeSignIn(user, request, { skipMfa: true });
}

// --- Classroom sign-in ------------------------------------------------------------------------------

const CLASS_CODE = /^[A-Z0-9]{4,12}$/;

export function normaliseClassCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

const classNotFound = () => new HttpError(404, "class_not_found", "We couldn't find that class code. Check it with your teacher.");

async function findClass(code: string) {
  const normalised = normaliseClassCode(code);
  if (!CLASS_CODE.test(normalised)) return null;
  return getDb().class.findUnique({ where: { code: normalised } });
}

/** Who can sign in with pictures in a class: active students who have pictures set up. */
export async function classRoster(code: string, request: Request): Promise<ClassRoster> {
  await enforceIpRateLimit(request, "class", 60, 10 * 60);
  const found = await findClass(code);
  if (!found) throw classNotFound();
  const members = await getDb().classMember.findMany({
    where: { classId: found.id, student: { role: "student", isActive: true, pictureHash: { not: null } } },
    select: { student: { select: { id: true, displayName: true, avatarUrl: true } } },
    orderBy: { student: { displayName: "asc" } },
  });
  const students = members.map(({ student }) => ({ id: student.id, display_name: student.displayName, avatar_url: student.avatarUrl }));
  return { class_name: found.name, students, pictures: [...PICTURE_KEYS] };
}

export const pictureKey = z.enum(PICTURE_KEYS, { error: "Pick pictures from the list." });
export const pictureSet = z
  .array(pictureKey)
  .length(PICTURE_COUNT, `Pick ${PICTURE_COUNT} different pictures.`)
  .refine((keys) => new Set(keys).size === keys.length, `Pick ${PICTURE_COUNT} different pictures.`);

export const pictureLoginInput = z.object({
  class_code: z.string().trim().min(1).max(20),
  student_id: z.uuid(),
  pictures: z.array(z.string().max(20)).length(PICTURE_COUNT),
});

export async function loginWithPictures(input: z.output<typeof pictureLoginInput>, request: Request): Promise<SignInOutcome> {
  await enforceIpRateLimit(request, "pictures", 300, 10 * 60);
  const wrong = () => new HttpError(401, "invalid_credentials", "Those pictures don't match. Try again.");
  const found = await findClass(input.class_code);
  if (!found) throw classNotFound();
  const member = await getDb().classMember.findUnique({
    where: { classId_studentId: { classId: found.id, studentId: input.student_id } },
    include: { student: true },
  });
  const student = member?.student;
  if (!student?.pictureHash || !student.isActive || student.role !== "student") {
    await verifyAgainstDummy(pictureSecret(input.pictures));
    throw wrong();
  }
  assertNotLocked(student, PICTURE_LOCKOUT);
  if (!(await verifyPassword(student.pictureHash, pictureSecret(input.pictures)))) {
    await recordFailedSignIn(student, PICTURE_LOCKOUT);
    throw wrong();
  }
  return completeSignIn(student, request, { sessionKind: "classroom", skipMfa: true });
}

// --- Passwords and email changes ----------------------------------------------------------------------

export async function forgotPassword({ email }: z.output<typeof emailInput>, request: Request) {
  await enforceIpRateLimit(request, "forgot", 20, 60 * 60);
  const user = await findUserByEmail(email);
  if (!user?.email || !user.isActive) return;
  try {
    await enforceRateLimit(`mail:reset:${user.id}`, 3, 60 * 60);
  } catch {
    return;
  }
  const { raw } = await issueToken("password_reset", { userId: user.id });
  await sendMail(emails.resetPassword(user.email, user.displayName, `${publicOrigin(request)}/reset-password?token=${encodeURIComponent(raw)}`));
}

export const resetInput = z.object({ token: tokenInput.shape.token, password });

/**
 * Sets a new password from the emailed link. Everyone is signed out (the person may be recovering a
 * stolen account), the lock is lifted, and the email counts as confirmed (they opened the link).
 * The person then signs in normally, including two-step verification.
 */
export async function resetPassword({ token, password: newPassword }: z.output<typeof resetInput>) {
  const row = await consumeToken("password_reset", token);
  if (!row?.userId) throw invalidLink();
  const passwordHash = await hashPassword(newPassword);
  const existing = await findUserById(row.userId);
  if (!existing) throw invalidLink();
  const user = await getDb().user.update({
    where: { id: existing.id },
    data: { passwordHash, failedSignIns: 0, lockedUntil: null, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
  });
  await deleteUserSessions(user.id);
  if (user.email) await sendMail(emails.passwordChanged(user.email, user.displayName));
}

/** Confirms an email change from the link sent to the new address. */
export async function confirmEmailChange({ token }: z.output<typeof tokenInput>, request: Request) {
  const row = await consumeToken("email_change", token);
  const newEmail = typeof row?.data.new_email === "string" ? row.data.new_email : null;
  if (!row?.userId || !newEmail) throw invalidLink();
  try {
    const [user] = await getDb().user.updateManyAndReturn({
      where: { id: row.userId },
      data: { email: newEmail, emailVerifiedAt: new Date() },
    });
    if (!user) throw invalidLink();
    await audit(request, { actorId: user.id, action: "account.email_changed", targetUserId: user.id });
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "email_taken", "Another account started using this email address. Choose a different one.");
    throw error;
  }
}

