import "server-only";

import type { Auth } from "@/server/auth/context";
import { getDb, type Executor } from "@/server/db";
import { forbidden } from "@/server/http/errors";

export type Role = "parent" | "teacher";

/** Parents and verified teachers take part; anyone else is refused. */
export async function messagingRole(auth: Auth, db: Executor = getDb()): Promise<Role> {
  if (auth.user.role === "parent") return "parent";
  if (auth.user.role === "teacher") {
    const profile = await db.teacherProfile.findUnique({ where: { userId: auth.user.id }, select: { verifiedAt: true } });
    if (!profile?.verifiedAt) throw forbidden("Your teacher account isn't verified yet. An admin checks every teacher before they can talk with families.");
    return "teacher";
  }
  throw forbidden("Messages are for parents and teachers.");
}

