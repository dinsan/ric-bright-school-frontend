import "server-only";

import { z } from "zod";
import { USERNAME_PATTERN, type Child } from "@/features/auth/contract";
import { MAX_GRADE, MIN_GRADE } from "@/features/catalog/constants";
import { fields } from "@/lib/forms/zod";
import { messages } from "@/lib/forms/messages";
import { toChild } from "@/server/accounts/serializers";
import type { Auth } from "@/server/auth/context";
import { hashPassword, pictureSecret } from "@/server/auth/password";
import { password, pictureSet } from "@/server/auth/service";
import { deleteUserSessions } from "@/server/auth/session";
import { consumeToken } from "@/server/auth/tokens";
import { getDb, isUniqueViolation } from "@/server/db";
import { fieldError, forbidden, HttpError, notFound } from "@/server/http/errors";
import { enforceRateLimit } from "@/server/http/rate-limit";

/** Parents and their children's accounts: everything under /api/me/children and /api/me/active-child. */

function assertParent(auth: Auth) {
  if (auth.user.role !== "parent") throw forbidden("Only parents and guardians manage children's accounts.");
}

/** The child, if it is one of this parent's children. */
async function ownChild(parentId: string, childId: string) {
  const row = await getDb().guardianship.findUnique({
    where: { parentId_childId: { parentId, childId } },
    include: { child: true },
  });
  return row?.child ?? null;
}

export async function listChildren(auth: Auth): Promise<Child[]> {
  assertParent(auth);
  const rows = await getDb().guardianship.findMany({
    where: { parentId: auth.user.id },
    include: { child: true },
    orderBy: [{ createdAt: "asc" }, { child: { displayName: "asc" } }],
  });
  return rows.map((row) => toChild(row.child));
}

export const childCreateInput = z.object({
  display_name: fields.text("your child's name", { max: 80 }),
  grade_level: z.coerce.number().int().min(MIN_GRADE).max(MAX_GRADE),
  parental_consent: z.literal(true, { error: messages.accept("confirm you are their parent or guardian") }),
});

/** Makes a student account for a child; the parent's confirmation is recorded as consent. */
export async function addChild(auth: Auth, input: z.output<typeof childCreateInput>): Promise<Child> {
  assertParent(auth);
  await enforceRateLimit(`add-child:${auth.user.id}`, 20, 24 * 60 * 60);
  const child = await getDb().$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        role: "student",
        displayName: input.display_name,
        gradeLevel: input.grade_level,
        createdById: auth.user.id,
        language: auth.user.language ?? "en",
        timezone: auth.user.timezone,
      },
    });
    await tx.guardianship.create({ data: { parentId: auth.user.id, childId: created.id, consentAt: new Date() } });
    // The first child becomes the one the app shows.
    if (!auth.user.activeChildId) await tx.user.update({ where: { id: auth.user.id }, data: { activeChildId: created.id } });
    return created;
  });
  return toChild(child);
}

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: messages.required("a username"), abort: true })
  .regex(USERNAME_PATTERN, "Use 3 to 30 letters or numbers (dots, dashes and underscores are fine too).");

export const signInSetupInput = z.discriminatedUnion(
  "method",
  [
    z.object({ method: z.literal("password"), username, password }),
    z.object({ method: z.literal("pictures"), username, pictures: pictureSet }),
  ],
  { error: messages.choose("how your child signs in") },
);

/**
 * Sets how a child signs in: a username with a password, or a username with 3 pictures (classroom
 * devices). One method at a time; changing it signs the child out of their devices.
 */
export async function setUpChildSignIn(auth: Auth, childId: string, input: z.output<typeof signInSetupInput>): Promise<Child> {
  assertParent(auth);
  const child = await ownChild(auth.user.id, childId);
  if (!child) throw notFound("That child");
  const secrets =
    input.method === "password"
      ? { passwordHash: await hashPassword(input.password), pictureHash: null }
      : { passwordHash: null, pictureHash: await hashPassword(pictureSecret(input.pictures)) };
  try {
    const updated = await getDb().user.update({
      where: { id: child.id },
      data: { username: input.username, ...secrets, failedSignIns: 0, lockedUntil: null },
    });
    await deleteUserSessions(child.id);
    return toChild(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw fieldError("username", "This username is taken. Try adding a number, like maya7.", { status: 409, code: "username_taken" });
    }
    throw error;
  }
}

export const linkChildInput = z.object({ code: z.string().trim().min(1, messages.required("the code")).max(20) });

/** Links an existing student account with the one-time code the student made (Account, then Connect a parent). */
export async function linkChild(auth: Auth, { code }: z.output<typeof linkChildInput>): Promise<Child> {
  assertParent(auth);
  await enforceRateLimit(`link-child:${auth.user.id}`, 10, 15 * 60);
  const normalised = code.replace(/[\s-]+/g, "").toUpperCase();
  const token = await consumeToken("parent_link", normalised);
  if (!token?.userId) throw fieldError("code", "This code doesn't work. Ask your child to make a new one.", { code: "invalid_code" });
  const db = getDb();
  const child = await db.user.findUnique({ where: { id: token.userId } });
  if (!child || child.role !== "student") throw fieldError("code", "This code doesn't work. Ask your child to make a new one.", { code: "invalid_code" });
  // INSERT … ON CONFLICT DO NOTHING: an existing link is reported, not duplicated.
  const inserted = await db.guardianship.createMany({ data: [{ parentId: auth.user.id, childId: child.id }], skipDuplicates: true });
  if (inserted.count === 0) throw new HttpError(409, "already_linked", `${child.displayName} is already linked to your account.`);
  if (!auth.user.activeChildId) await db.user.update({ where: { id: auth.user.id }, data: { activeChildId: child.id } });
  return toChild(child);
}

export const activeChildInput = z.object({ child_id: z.uuid() });

export async function setActiveChild(auth: Auth, { child_id }: z.output<typeof activeChildInput>) {
  assertParent(auth);
  if (!(await ownChild(auth.user.id, child_id))) throw notFound("That child");
  await getDb().user.update({ where: { id: auth.user.id }, data: { activeChildId: child_id } });
}
