import "server-only";

import { getDb, type SessionRow, type UserRow } from "@/server/db";
import { clientIp, userAgent } from "@/server/http/request";
import { CLASSROOM_SESSION_SECONDS, IMPERSONATION_SESSION_SECONDS, SESSION_SECONDS } from "./cookies";
import { randomToken, sha256 } from "./crypto";

/**
 * Sessions live in PostgreSQL. The browser holds a random 256-bit token in an httpOnly cookie; the
 * database only stores its SHA-256, so a database leak doesn't hand out sessions. Signing out, "sign out
 * everywhere else", password changes and turning an account off delete rows, which ends those sessions
 * on the next request. See docs/auth.md.
 */

/** last_seen_at is written at most this often per session. */
const TOUCH_SECONDS = 5 * 60;

export type SessionKind = SessionRow["kind"];

const lifetime: Record<SessionKind, number> = {
  standard: SESSION_SECONDS,
  classroom: CLASSROOM_SESSION_SECONDS,
  impersonation: IMPERSONATION_SESSION_SECONDS,
};

export interface CreatedSession {
  token: string;
  session: SessionRow;
}

export async function createSession(
  userId: string,
  request: Request,
  { kind = "standard", impersonatorId = null }: { kind?: SessionKind; impersonatorId?: string | null } = {},
): Promise<CreatedSession> {
  const db = getDb();
  const token = randomToken();
  const session = await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      kind,
      impersonatorId,
      userAgent: userAgent(request),
      ipAddress: clientIp(request),
      expiresAt: new Date(Date.now() + lifetime[kind] * 1000),
    },
  });
  // Now and then, clear out expired sessions.
  if (Math.random() < 0.02) await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { token, session };
}

export interface ValidSession {
  session: SessionRow;
  user: UserRow;
}

/**
 * The session and user for a token, or null when the token is unknown, expired, or the account is turned
 * off. Standard sessions slide: used in their second half, they are extended to a full 30 days again.
 * Throws when the database is unreachable (callers tell "unavailable" apart from "signed out").
 */
export async function validateSessionToken(token: string | undefined | null): Promise<ValidSession | null> {
  if (!token || token.length > 200) return null;
  const db = getDb();
  const row = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.expiresAt.getTime() <= Date.now() || !row.user.isActive) return null;

  const { user, ...session } = row;
  const now = Date.now();
  const extend = session.kind === "standard" && session.expiresAt.getTime() - now < (SESSION_SECONDS * 1000) / 2;
  const touch = now - session.lastSeenAt.getTime() > TOUCH_SECONDS * 1000;
  if (extend || touch) {
    const update: { lastSeenAt: Date; expiresAt?: Date } = { lastSeenAt: new Date(now) };
    if (extend) update.expiresAt = new Date(now + SESSION_SECONDS * 1000);
    // deleteMany / updateMany: no error if the session was deleted meanwhile (signed out elsewhere).
    await db.session.updateMany({ where: { id: session.id }, data: update });
    Object.assign(session, update);
  }
  return { session, user };
}

export async function deleteSession(sessionId: string) {
  await getDb().session.deleteMany({ where: { id: sessionId } });
}

export async function deleteSessionByToken(token: string) {
  await getDb().session.deleteMany({ where: { tokenHash: sha256(token) } });
}

/** Ends every session of a user, except `exceptSessionId` (the one making the request). */
export async function deleteUserSessions(userId: string, exceptSessionId?: string) {
  await getDb().session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}

// Cookie names and writers live in ./cookies (no database code: the proxy imports them).
export * from "./cookies";
