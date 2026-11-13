import "server-only";

import { z } from "zod";
import { ROLES, type AdminUser, type UserPage } from "@/features/auth/contract";
import { clearMfa } from "@/server/accounts/service";
import { findUserById, teacherProfileFor } from "@/server/accounts/queries";
import { toAdminUser } from "@/server/accounts/serializers";
import { audit } from "@/server/audit";
import type { Auth } from "@/server/auth/context";
import { createSession, deleteUserSessions, type CreatedSession } from "@/server/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import { escapeLike, getDb, type UserRow } from "@/server/db";
import { forbidden, HttpError, notFound } from "@/server/http/errors";

/** Platform administration: everything under /api/admin. Every change is recorded in audit_events. */

export const userSearchInput = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export async function searchUsers({ q, role, limit, offset }: z.output<typeof userSearchInput>): Promise<UserPage> {
  const db = getDb();
  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role as UserRow["role"];
  if (q) {
    // ILIKE '%q%', with `%` and `_` typed in the search as letters, not wildcards.
    const contains = { contains: escapeLike(q), mode: "insensitive" } as const;
    where.OR = [{ displayName: contains }, { email: contains }, { username: contains }];
  }
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      include: { teacherProfile: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
    }),
    db.user.count({ where }),
  ]);
  return { items: rows.map(({ teacherProfile, ...user }) => toAdminUser(user, teacherProfile)), total, limit, offset };
}

async function loadTarget(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw notFound("That user");
  return user;
}

async function adminView(user: UserRow): Promise<AdminUser> {
  return toAdminUser(user, user.role === "teacher" ? await teacherProfileFor(user.id) : null);
}

export async function getUser(userId: string): Promise<AdminUser> {
  return adminView(await loadTarget(userId));
}

export const userUpdateInput = z
  .object({
    role: z.enum(ROLES as [string, ...string[]]).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.is_active !== undefined, "Change the role or the status.");

/** Role changes and turning accounts off/on. Admins can't change their own account here. */
export async function updateUser(auth: Auth, userId: string, input: z.output<typeof userUpdateInput>, request: Request): Promise<AdminUser> {
  if (userId === auth.user.id) throw forbidden("You can't change your own account here. Ask another admin.");
  const target = await loadTarget(userId);
  const role = input.role as UserRow["role"] | undefined;
  const db = getDb();
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.user.update({ where: { id: target.id }, data: { role, isActive: input.is_active } });
    if (role === "teacher") await tx.teacherProfile.createMany({ data: [{ userId: target.id }], skipDuplicates: true });
    await audit(
      request,
      {
        actorId: auth.user.id,
        action: "admin.user_updated",
        targetUserId: target.id,
        data: { from: { role: target.role, is_active: target.isActive }, to: { role: row.role, is_active: row.isActive } },
      },
      tx,
    );
    return row;
  });
  // Turned off, or a different role: they sign in again (their pages and permissions change).
  if (input.is_active === false || (role && role !== target.role)) await deleteUserSessions(target.id);
  return adminView(updated);
}

export const teacherVerificationInput = z.object({ verified: z.boolean() });

export async function setTeacherVerification(auth: Auth, userId: string, { verified }: z.output<typeof teacherVerificationInput>, request: Request) {
  const target = await loadTarget(userId);
  if (target.role !== "teacher") throw new HttpError(409, "not_a_teacher", "Only teacher accounts can be verified.");
  const values = verified ? { verifiedAt: new Date(), verifiedById: auth.user.id } : { verifiedAt: null, verifiedById: null };
  await getDb().teacherProfile.upsert({ where: { userId: target.id }, create: { userId: target.id, ...values }, update: values });
  await audit(request, { actorId: auth.user.id, action: "admin.teacher_verification", targetUserId: target.id, data: { verified } });
  return adminView(target);
}

export async function resetMfa(auth: Auth, userId: string, request: Request) {
  if (userId === auth.user.id) throw forbidden("You can't reset your own two-step verification here. Ask another admin.");
  const target = await loadTarget(userId);
  await clearMfa(target.id);
  await audit(request, { actorId: auth.user.id, action: "admin.mfa_reset", targetUserId: target.id });
}

/**
 * Support impersonation: a one-hour session as the user, marked with the admin's id. The route keeps the
 * admin's own session token aside (httpOnly cookie) so "Stop viewing" returns to it.
 */
export async function startImpersonation(auth: Auth, userId: string, request: Request): Promise<{ target: UserRow; created: CreatedSession }> {
  if (auth.session.kind === "impersonation") throw new HttpError(409, "already_impersonating", "Stop the current impersonation first.");
  if (userId === auth.user.id) throw forbidden("You can't view as yourself.");
  const target = await loadTarget(userId);
  if (target.role === "admin") throw forbidden("Admins can't view as other admins.");
  if (!target.isActive) throw new HttpError(409, "account_disabled", "This account is turned off. Turn it back on first.");
  const created = await createSession(target.id, request, { kind: "impersonation", impersonatorId: auth.user.id });
  await audit(request, { actorId: auth.user.id, action: "admin.impersonation_started", targetUserId: target.id });
  return { target, created };
}

