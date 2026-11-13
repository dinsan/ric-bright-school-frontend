import "server-only";

import type { Me } from "@/features/auth/contract";
import { getDb, type UserRow } from "@/server/db";
import { toMe } from "./serializers";

export async function findUserById(userId: string): Promise<UserRow | null> {
  return getDb().user.findUnique({ where: { id: userId } });
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return getDb().user.findUnique({ where: { email: normaliseEmail(email) } });
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  return getDb().user.findUnique({ where: { username: username.trim().toLowerCase() } });
}

export async function teacherProfileFor(userId: string) {
  return getDb().teacherProfile.findUnique({ where: { userId } });
}

/** The Me payload for a user row (adds the teacher profile for teachers). */
export async function meFor(user: UserRow): Promise<Me> {
  return toMe(user, user.role === "teacher" ? await teacherProfileFor(user.id) : null);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
