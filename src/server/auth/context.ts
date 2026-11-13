import "server-only";

import type { NextRequest } from "next/server";
import type { Role } from "@/features/auth/contract";
import type { SessionRow, UserRow } from "@/server/db";
import { forbidden, HttpError, notAuthenticated } from "@/server/http/errors";
import { COOKIE, validateSessionToken } from "./session";

/** The signed-in user of an API request (Route Handlers). */
export interface Auth {
  user: UserRow;
  session: SessionRow;
  /** The raw session token from the cookie (needed to hand a session over, e.g. impersonation). */
  token: string;
}

export async function getAuth(request: NextRequest): Promise<Auth | null> {
  const token = request.cookies.get(COOKIE.session)?.value;
  if (!token) return null;
  const valid = await validateSessionToken(token);
  return valid ? { ...valid, token } : null;
}

/** The signed-in user, or 401. With `roles`, other roles get 403. */
export async function requireAuth(request: NextRequest, roles?: readonly Role[]): Promise<Auth> {
  const auth = await getAuth(request);
  if (!auth) throw notAuthenticated();
  if (roles && !roles.includes(auth.user.role)) throw forbidden();
  return auth;
}

/**
 * Credentials and account deletion stay with the account owner: an admin viewing as someone
 * (support impersonation) can't change them.
 */
export function assertNotImpersonating(auth: Auth) {
  if (auth.session.kind === "impersonation") {
    throw new HttpError(403, "impersonation_restricted", "You are viewing as this person. Sign-in details can only be changed by the account owner.");
  }
}
