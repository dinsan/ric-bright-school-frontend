import "server-only";

import type { Prisma, TokenPurpose } from "@/generated/prisma/client";
import { getDb, type AuthTokenRow } from "@/server/db";
import { randomToken, sha256 } from "./crypto";

/**
 * One-time tokens (see the auth_tokens table). The raw token goes to the person (email link, cookie,
 * a code to type); the database keeps its SHA-256. Consuming is a single conditional UPDATE, so two
 * requests racing with the same link can't both succeed.
 */

export type { TokenPurpose };
/** An auth_tokens row; `data` is always a JSON object (written by issueToken). */
export type TokenRow = Omit<AuthTokenRow, "data"> & { data: Record<string, unknown> };

export const TOKEN_SECONDS: Record<TokenPurpose, number> = {
  email_verification: 48 * 60 * 60,
  password_reset: 60 * 60,
  email_change: 24 * 60 * 60,
  mfa_challenge: 10 * 60,
  parent_link: 7 * 24 * 60 * 60,
  oauth_state: 10 * 60,
};

interface IssueOptions {
  userId?: string | null;
  data?: Record<string, unknown>;
  /** The raw value (e.g. a short code to type); default: a random 256-bit token. */
  raw?: string;
  /** Invalidate this user's earlier unused tokens for the same purpose (only the newest link works). */
  replace?: boolean;
}

const asTokenRow = (row: AuthTokenRow): TokenRow => row as TokenRow;

export async function issueToken(purpose: TokenPurpose, { userId = null, data = {}, raw = randomToken(), replace = true }: IssueOptions = {}) {
  const db = getDb();
  if (replace && userId) {
    await db.authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
  }
  const row = await db.authToken.create({
    data: {
      purpose,
      tokenHash: sha256(raw),
      userId,
      data: data as Prisma.InputJsonObject,
      expiresAt: new Date(Date.now() + TOKEN_SECONDS[purpose] * 1000),
    },
  });
  if (Math.random() < 0.02) {
    await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  }
  return { raw, row: asTokenRow(row) };
}

const usable = (purpose: TokenPurpose, raw: string): Prisma.AuthTokenWhereInput => ({
  tokenHash: sha256(raw),
  purpose,
  usedAt: null,
  expiresAt: { gt: new Date() },
});

/** The token if it is still usable, without using it. */
export async function findToken(purpose: TokenPurpose, raw: string | null | undefined): Promise<TokenRow | null> {
  if (!raw || raw.length > 200) return null;
  const row = await getDb().authToken.findFirst({ where: usable(purpose, raw) });
  return row ? asTokenRow(row) : null;
}

/** Marks the token used and returns it; null when unknown, expired or already used. */
export async function consumeToken(purpose: TokenPurpose, raw: string | null | undefined): Promise<TokenRow | null> {
  if (!raw || raw.length > 200) return null;
  // One `UPDATE … WHERE used_at IS NULL … RETURNING`: of two racing requests, only one gets the row.
  const [row] = await getDb().authToken.updateManyAndReturn({ where: usable(purpose, raw), data: { usedAt: new Date() } });
  return row ? asTokenRow(row) : null;
}

/** Counts a wrong guess against a token; at `max` the token stops working. Returns the new count. */
export async function recordTokenAttempt(tokenId: string, max: number): Promise<number> {
  // Raw SQL: the new used_at depends on the stored count, in the same atomic UPDATE.
  const [row] = await getDb().$queryRaw<{ attempts: number }[]>`
    update auth_tokens
    set attempts = attempts + 1,
        used_at = case when attempts + 1 >= ${max} then now() else used_at end
    where id = ${tokenId}::uuid
    returning attempts`;
  return row?.attempts ?? max;
}
