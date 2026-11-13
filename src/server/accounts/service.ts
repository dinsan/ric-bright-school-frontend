import "server-only";

import { z } from "zod";
import { LANGUAGES, type LinkCode, type Me, type OAuthProvider, type RecoveryCodes, type TotpSetup } from "@/features/auth/contract";
import { GRADES } from "@/features/catalog/constants";
import { fields } from "@/lib/forms/zod";
import { messages } from "@/lib/forms/messages";
import { audit } from "@/server/audit";
import type { Auth } from "@/server/auth/context";
import { assertNotImpersonating } from "@/server/auth/context";
import { CODE_ALPHABET, encryptSecret, randomCode } from "@/server/auth/crypto";
import { checkSecondFactor, checkTotp, generateRecoveryCodes } from "@/server/auth/mfa";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { password as newPasswordSchema } from "@/server/auth/service";
import { deleteUserSessions } from "@/server/auth/session";
import { issueToken } from "@/server/auth/tokens";
import { generateTotpSecret, otpauthUri } from "@/server/auth/totp";
import { getDb, isUniqueViolation } from "@/server/db";
import { fieldError, forbidden, HttpError, notFound } from "@/server/http/errors";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { publicOrigin } from "@/server/http/request";
import { sendMail } from "@/server/mail";
import { emails } from "@/server/mail/templates";
import { findUserByEmail, findUserById, meFor, normaliseEmail } from "./queries";
import { toLinkedAccount, toSession } from "./serializers";

/** The signed-in person's own account: everything under /api/me. */

async function reload(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw notFound("Your account");
  return user;
}

/** Re-entering the password for a sensitive change; limited so a stolen session can't guess it. */
async function confirmPassword(auth: Auth, password: string | undefined, field: string) {
  await enforceRateLimit(`reauth:${auth.user.id}`, 10, 15 * 60);
  if (!auth.user.passwordHash) {
    throw fieldError(field, "Your account has no password yet. Sign out and use \"Forgot your password?\" to set one.");
  }
  if (!password) throw fieldError(field, messages.required("your password"));
  if (!(await verifyPassword(auth.user.passwordHash, password))) {
    throw fieldError(field, field === "current_password" ? "That's not your current password." : "That's not your password.", { code: "invalid_password" });
  }
}

// --- Profile ----------------------------------------------------------------------------------------

const languageCodes = LANGUAGES.map(([code]) => code) as [string, ...string[]];

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const profileInput = z.object({
  display_name: fields.text("your name", { max: 80 }).optional(),
  language: z.enum(languageCodes, { error: messages.choose("a language") }).optional(),
  timezone: z.string().max(64).refine(isTimeZone, messages.choose("a time zone")).optional(),
});

export async function updateProfile(auth: Auth, input: z.output<typeof profileInput>): Promise<Me> {
  // Prisma skips `undefined` fields: only what was sent changes.
  const user = await getDb().user.update({
    where: { id: auth.user.id },
    data: { displayName: input.display_name, language: input.language, timezone: input.timezone },
  });
  return meFor(user);
}

export const teacherProfileInput = z.object({
  school_name: z.string().trim().max(120).nullable().optional(),
  subjects: z.array(z.string().max(80)).max(50).optional(),
  grade_levels: z
    .array(z.number().int().refine((grade) => GRADES.includes(grade), messages.choose("grades from the list")))
    .max(12)
    .optional(),
  bio: z.string().trim().max(600).nullable().optional(),
});

export async function updateTeacherProfile(auth: Auth, input: z.output<typeof teacherProfileInput>): Promise<Me> {
  if (auth.user.role !== "teacher") throw forbidden("Only teachers have a teacher profile.");
  const db = getDb();
  const subjectSlugs = input.subjects ? [...new Set(input.subjects)] : undefined;
  if (subjectSlugs?.length) {
    const known = await db.subject.count({ where: { slug: { in: subjectSlugs } } });
    if (known !== subjectSlugs.length) throw fieldError("subjects", messages.choose("subjects from the list"));
  }
  const values = {
    schoolName: input.school_name === undefined ? undefined : input.school_name || null,
    subjects: subjectSlugs,
    gradeLevels: input.grade_levels ? [...new Set(input.grade_levels)].sort((a, b) => a - b) : undefined,
    bio: input.bio === undefined ? undefined : input.bio || null,
  };
  await db.teacherProfile.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id, ...values }, update: values });
  return meFor(auth.user);
}

// --- Password and email -------------------------------------------------------------------------------

export const passwordChangeInput = z.object({
  current_password: z.string().max(256),
  new_password: newPasswordSchema,
});

/** New password; every other device is signed out. */
export async function changePassword(auth: Auth, input: z.output<typeof passwordChangeInput>, request: Request) {
  assertNotImpersonating(auth);
  await confirmPassword(auth, input.current_password, "current_password");
  if (input.current_password === input.new_password) throw fieldError("new_password", "Choose a password you haven't used here before.");
  await getDb().user.update({ where: { id: auth.user.id }, data: { passwordHash: await hashPassword(input.new_password) } });
  await deleteUserSessions(auth.user.id, auth.session.id);
  await audit(request, { actorId: auth.user.id, action: "account.password_changed", targetUserId: auth.user.id });
  if (auth.user.email) await sendMail(emails.passwordChanged(auth.user.email, auth.user.displayName));
}

export const emailChangeInput = z.object({
  new_email: fields.email("your new email address"),
  password: z.string().max(256),
});

/** Sends a confirmation link to the new address (the change happens when it's opened) and a notice to the old one. */
export async function requestEmailChange(auth: Auth, input: z.output<typeof emailChangeInput>, request: Request) {
  assertNotImpersonating(auth);
  if (!auth.user.email) throw forbidden("This account has no email address.");
  await confirmPassword(auth, input.password, "password");
  const newEmail = normaliseEmail(input.new_email);
  if (newEmail === auth.user.email) throw fieldError("new_email", "This is already your email address.");
  if (await findUserByEmail(newEmail)) {
    throw fieldError("new_email", "Another account uses this email address. Choose a different one.", { status: 409, code: "email_taken" });
  }
  const { raw } = await issueToken("email_change", { userId: auth.user.id, data: { new_email: newEmail } });
  const origin = publicOrigin(request);
  await sendMail(emails.confirmEmailChange(newEmail, auth.user.displayName, `${origin}/confirm-email?token=${encodeURIComponent(raw)}`));
  await sendMail(emails.emailChangeRequested(auth.user.email, auth.user.displayName, newEmail));
}

// --- Sessions ---------------------------------------------------------------------------------------

/** Where the person is signed in. Sessions of admins viewing as them are not listed (except the current one). */
export async function listSessions(auth: Auth) {
  const rows = await getDb().session.findMany({
    where: {
      userId: auth.user.id,
      expiresAt: { gt: new Date() },
      OR: [{ impersonatorId: null }, { id: auth.session.id }],
    },
    orderBy: { lastSeenAt: "desc" },
  });
  return rows.map((row) => toSession(row, auth.session.id));
}

export async function endSession(auth: Auth, sessionId: string) {
  const deleted = await getDb().session.deleteMany({ where: { id: sessionId, userId: auth.user.id } });
  if (deleted.count === 0) throw notFound("That session");
}

export async function endOtherSessions(auth: Auth) {
  await deleteUserSessions(auth.user.id, auth.session.id);
}

// --- Linked accounts (Google, Microsoft, Apple) ---------------------------------------------------------

export async function linkedAccounts(auth: Auth) {
  const rows = await getDb().oAuthAccount.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: "asc" } });
  return rows.map(toLinkedAccount);
}

/** Unlinks a provider, unless it's the only way left to sign in. */
export async function unlinkAccount(auth: Auth, provider: OAuthProvider) {
  assertNotImpersonating(auth);
  const db = getDb();
  const linked = await db.oAuthAccount.count({ where: { userId: auth.user.id } });
  const account = await db.oAuthAccount.findUnique({
    where: { userId_provider: { userId: auth.user.id, provider } },
    select: { id: true },
  });
  if (!account) throw notFound("That linked account");
  if (!auth.user.passwordHash && linked <= 1) {
    throw new HttpError(409, "last_sign_in_method", "This is the only way you sign in. Set a password first (Forgot your password? on the sign-in page), then unlink it.");
  }
  await db.oAuthAccount.deleteMany({ where: { id: account.id } });
}

// --- Two-step verification -------------------------------------------------------------------------

export const codeInput = z.object({ code: z.string().trim().min(1, messages.required("the code")).max(32) });

const wrongCode = () => fieldError("code", "That code didn't work. Check the time on your phone is right, and try again.", { code: "invalid_code" });

function assertAdult(auth: Auth) {
  if (auth.user.role === "student") throw forbidden("Two-step verification is for adult accounts.");
}

/** Starts the setup: a new secret, kept pending until a first code proves the app has it. */
export async function startTotp(auth: Auth): Promise<TotpSetup> {
  assertNotImpersonating(auth);
  assertAdult(auth);
  if (auth.user.mfaEnabledAt) throw new HttpError(409, "mfa_already_enabled", "Two-step verification is already on.");
  const secret = generateTotpSecret();
  await getDb().user.update({ where: { id: auth.user.id }, data: { totpPendingSecret: encryptSecret(secret) } });
  const account = auth.user.email ?? auth.user.username ?? auth.user.displayName;
  return { secret, otpauth_uri: otpauthUri(secret, account) };
}

export async function confirmTotp(auth: Auth, { code }: z.output<typeof codeInput>, request: Request): Promise<RecoveryCodes> {
  assertNotImpersonating(auth);
  assertAdult(auth);
  await enforceRateLimit(`mfa-setup:${auth.user.id}`, 10, 15 * 60);
  const user = await reload(auth.user.id);
  if (user.mfaEnabledAt) throw new HttpError(409, "mfa_already_enabled", "Two-step verification is already on.");
  if (!user.totpPendingSecret) throw new HttpError(409, "mfa_setup_missing", "Start the setup again.");
  if (!(await checkTotp(user, code, user.totpPendingSecret))) throw wrongCode();
  const codes = await getDb().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { totpSecret: user.totpPendingSecret, totpPendingSecret: null, mfaEnabledAt: new Date() },
    });
    return generateRecoveryCodes(user.id, tx);
  });
  await audit(request, { actorId: user.id, action: "account.mfa_enabled", targetUserId: user.id });
  return { recovery_codes: codes };
}

export async function disableTotp(auth: Auth, { code }: z.output<typeof codeInput>, request: Request) {
  assertNotImpersonating(auth);
  await enforceRateLimit(`mfa-code:${auth.user.id}`, 10, 15 * 60);
  const user = await reload(auth.user.id);
  if (!user.mfaEnabledAt) throw new HttpError(409, "mfa_not_enabled", "Two-step verification is already off.");
  if (!(await checkSecondFactor(user, code))) throw wrongCode();
  await clearMfa(user.id);
  await audit(request, { actorId: user.id, action: "account.mfa_disabled", targetUserId: user.id });
}

export async function regenerateRecoveryCodes(auth: Auth, { code }: z.output<typeof codeInput>): Promise<RecoveryCodes> {
  assertNotImpersonating(auth);
  await enforceRateLimit(`mfa-code:${auth.user.id}`, 10, 15 * 60);
  const user = await reload(auth.user.id);
  if (!user.mfaEnabledAt) throw new HttpError(409, "mfa_not_enabled", "Turn on two-step verification first.");
  if (!(await checkSecondFactor(user, code, { allowRecovery: false }))) throw wrongCode();
  return { recovery_codes: await generateRecoveryCodes(user.id) };
}

export async function clearMfa(userId: string) {
  await getDb().$transaction([
    getDb().user.updateMany({ where: { id: userId }, data: { totpSecret: null, totpPendingSecret: null, totpLastStep: null, mfaEnabledAt: null } }),
    getDb().recoveryCode.deleteMany({ where: { userId } }),
  ]);
}

// --- Students: a code for a parent ---------------------------------------------------------------------

const LINK_CODE_LENGTH = 8;

export async function createLinkCode(auth: Auth): Promise<LinkCode> {
  if (auth.user.role !== "student") throw forbidden("Only students make codes for a parent.");
  await enforceRateLimit(`link-code:${auth.user.id}`, 10, 60 * 60);
  for (let attempt = 0; ; attempt++) {
    const code = randomCode(LINK_CODE_LENGTH, CODE_ALPHABET);
    try {
      const { row } = await issueToken("parent_link", { userId: auth.user.id, raw: code });
      return { code, expires_at: row.expiresAt.toISOString() };
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= 3) throw error;
    }
  }
}

// --- Delete account -------------------------------------------------------------------------------

export const deleteInput = z.object({ password: z.string().max(256).optional() });

/**
 * Deletes the account and everything that belongs to it (sessions, links, tokens: ON DELETE CASCADE).
 * Children's accounts are separate accounts and stay; only the link to this parent goes.
 */
export async function deleteAccount(auth: Auth, { password }: z.output<typeof deleteInput>, request: Request) {
  assertNotImpersonating(auth);
  if (auth.user.role === "student") throw forbidden("Ask your parent or teacher to delete your account.");
  if (auth.user.passwordHash) await confirmPassword(auth, password, "password");
  const db = getDb();
  await db.$transaction(async (tx) => {
    if (auth.user.role === "admin") {
      const admins = await tx.user.count({ where: { role: "admin", isActive: true, id: { not: auth.user.id } } });
      if (admins === 0) throw new HttpError(409, "last_admin", "You are the only admin. Make someone else an admin before deleting your account.");
    }
    await audit(request, { actorId: null, action: "account.deleted", data: { user_id: auth.user.id, role: auth.user.role } }, tx);
    await tx.user.delete({ where: { id: auth.user.id } });
  });
}
