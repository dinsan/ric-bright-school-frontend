import "server-only";

import { getDb, type Executor, type UserRow } from "@/server/db";
import { decryptSecret, randomCode, sha256 } from "./crypto";
import { verifyTotp } from "./totp";

/** Two-step verification: TOTP codes (with replay protection) and single-use recovery codes. */

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function normaliseRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Checks a 6-digit code against the user's active secret and records its time step, atomically, so the
 * same code can't be used twice (even by two requests at once).
 */
export async function checkTotp(user: UserRow, code: string, secret = user.totpSecret): Promise<boolean> {
  if (!secret) return false;
  const step = verifyTotp(decryptSecret(secret), code.trim(), { lastUsedStep: user.totpLastStep });
  if (step === null) return false;
  const updated = await getDb().user.updateMany({
    where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return updated.count > 0;
}

/** Uses a recovery code (once). */
export async function redeemRecoveryCode(userId: string, code: string): Promise<boolean> {
  const normalised = normaliseRecoveryCode(code);
  if (normalised.length < 8) return false;
  const used = await getDb().recoveryCode.updateMany({
    where: { userId, codeHash: sha256(normalised), usedAt: null },
    data: { usedAt: new Date() },
  });
  return used.count > 0;
}

/** A TOTP code, or (when `allowRecovery`) a recovery code. */
export async function checkSecondFactor(user: UserRow, code: string, { allowRecovery = true } = {}): Promise<boolean> {
  const compact = code.replace(/\s+/g, "");
  if (/^\d{6}$/.test(compact)) return checkTotp(user, compact);
  return allowRecovery ? redeemRecoveryCode(user.id, compact) : false;
}

/** Replaces the user's recovery codes with new ones and returns them (shown once, stored hashed). */
export async function generateRecoveryCodes(userId: string, db: Executor = getDb()): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => `${randomCode(4, RECOVERY_ALPHABET)}-${randomCode(4, RECOVERY_ALPHABET)}`);
  await db.recoveryCode.deleteMany({ where: { userId } });
  await db.recoveryCode.createMany({ data: codes.map((code) => ({ userId, codeHash: sha256(normaliseRecoveryCode(code)) })) });
  return codes;
}
