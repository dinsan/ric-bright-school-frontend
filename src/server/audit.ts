import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb, type Executor } from "@/server/db";
import { clientIp } from "@/server/http/request";

/** Audit actions. Admin actions and impersonation are always recorded (FE-ADM-02 will show them). */
export type AuditAction =
  | "admin.user_updated"
  | "admin.teacher_verification"
  | "admin.mfa_reset"
  | "admin.impersonation_started"
  | "admin.impersonation_stopped"
  | "admin.course_price_updated"
  | "family.child_deleted"
  | "account.deleted"
  | "account.password_changed"
  | "account.email_changed"
  | "account.mfa_enabled"
  | "account.mfa_disabled";

export async function audit(
  request: Request | null,
  { actorId, action, targetUserId = null, data = {} }: { actorId: string | null; action: AuditAction; targetUserId?: string | null; data?: Record<string, unknown> },
  db: Executor = getDb(),
) {
  await db.auditEvent.create({
    data: { actorId, action, targetUserId, data: data as Prisma.InputJsonObject, ipAddress: request ? clientIp(request) : null },
  });
}
