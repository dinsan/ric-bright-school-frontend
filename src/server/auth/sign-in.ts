import "server-only";

import { NextResponse } from "next/server";
import type { SignInResult } from "@/features/auth/contract";
import { meFor } from "@/server/accounts/queries";
import { getDb, type SessionRow, type UserRow } from "@/server/db";
import { HttpError } from "@/server/http/errors";
import { isSecureRequest } from "@/server/http/request";
import { createSession, writeMfaCookie, writeSessionCookies, type SessionKind } from "./session";
import { issueToken } from "./tokens";

/**
 * What happens after credentials are checked, whatever the method (email, username, pictures, OAuth,
 * email verification): either a session, or, for accounts with two-step verification, the MFA step.
 */

export type SignInOutcome = { kind: "session"; user: UserRow; token: string; session: SessionRow } | { kind: "mfa"; challenge: string };

export async function completeSignIn(
  user: UserRow,
  request: Request,
  { sessionKind = "standard", skipMfa = false }: { sessionKind?: SessionKind; skipMfa?: boolean } = {},
): Promise<SignInOutcome> {
  if (user.mfaEnabledAt && !skipMfa) {
    const { raw } = await issueToken("mfa_challenge", { userId: user.id });
    return { kind: "mfa", challenge: raw };
  }
  const { token, session } = await createSession(user.id, request, { kind: sessionKind });
  const [updated] = await getDb().user.updateManyAndReturn({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedSignIns: 0, lockedUntil: null },
  });
  return { kind: "session", user: updated ?? user, token, session };
}

/** Writes the cookies for a sign-in outcome: the session (and role hint), or the MFA step. */
export function signInCookies(jar: CookieJar, outcome: SignInOutcome, request: Request) {
  const secure = isSecureRequest(request);
  if (outcome.kind === "mfa") writeMfaCookie(jar, outcome.challenge, secure);
  else writeSessionCookies(jar, outcome.token, outcome.user.role, secure);
}

type CookieJar = NextResponse["cookies"];

/** The browser's answer: `{signed_in, user}` with the session cookies, or `{mfa_required}` with the MFA step cookie. */
export async function signInResponse(request: Request, outcome: SignInOutcome, status = 200): Promise<NextResponse> {
  const body: SignInResult = outcome.kind === "mfa" ? { mfa_required: true } : { signed_in: true, user: await meFor(outcome.user) };
  const response = NextResponse.json<SignInResult>(body, { status });
  signInCookies(response.cookies, outcome, request);
  return response;
}

// --- Lockout ----------------------------------------------------------------------------------------

export interface LockoutPolicy {
  /** Wrong attempts in a row before the account is locked. */
  maxAttempts: number;
  lockSeconds: number;
  /** 429 for passwords (the UI says "wait a minute"), 423 for pictures (the UI says "ask your teacher"). */
  status: 423 | 429;
}

export const PASSWORD_LOCKOUT: LockoutPolicy = { maxAttempts: 10, lockSeconds: 15 * 60, status: 429 };
export const PICTURE_LOCKOUT: LockoutPolicy = { maxAttempts: 5, lockSeconds: 15 * 60, status: 423 };

function lockedError(policy: LockoutPolicy, until: Date) {
  const retryAfter = String(Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000)));
  return policy.status === 423
    ? new HttpError(423, "account_locked", "That was a lot of tries. Ask your teacher to help you sign in.", { headers: { "retry-after": retryAfter } })
    : new HttpError(429, "too_many_attempts", "That was a lot of tries. Wait a few minutes, then try again, or reset your password.", {
        headers: { "retry-after": retryAfter },
      });
}

export function assertNotLocked(user: UserRow, policy: LockoutPolicy) {
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) throw lockedError(policy, user.lockedUntil);
}

/** Counts a failed attempt; throws the lock error when this attempt reached the limit. */
export async function recordFailedSignIn(user: UserRow, policy: LockoutPolicy) {
  // Raw SQL: the lock depends on the stored count, in the same atomic UPDATE.
  const [row] = await getDb().$queryRaw<{ failed_sign_ins: number; locked_until: Date | null }[]>`
    update users
    set failed_sign_ins = failed_sign_ins + 1,
        locked_until = case
          when failed_sign_ins + 1 >= ${policy.maxAttempts} then now() + make_interval(secs => ${policy.lockSeconds})
          else locked_until
        end
    where id = ${user.id}::uuid
    returning failed_sign_ins, locked_until`;
  if (row && row.failed_sign_ins >= policy.maxAttempts && row.locked_until) {
    // Start counting again after the lock.
    await getDb().user.update({ where: { id: user.id }, data: { failedSignIns: 0 } });
    throw lockedError(policy, row.locked_until);
  }
}
