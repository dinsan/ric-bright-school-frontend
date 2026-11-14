import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { roleHome, type Me, type Role } from "@/features/auth/contract";
import { meFor } from "@/server/accounts/queries";
import { isDatabaseUnavailable } from "@/server/db";
import { COOKIE, PATH_HEADER } from "./cookies";
import type { Auth } from "./context";
import { validateSessionToken } from "./session";

/**
 * The signed-in user for Server Components and layouts. Reads the session cookie and checks it in the
 * database once per request (React cache). Server Components can't change cookies, so a stale cookie
 * is cleared by /auth/resume (see requireUser).
 */

export { PATH_HEADER };

export type MeResult = { status: "ok"; user: Me; impersonating: boolean } | { status: "unauthorized" } | { status: "unavailable" };

/** The session behind the cookie, checked once per request (React cache): shared by the helpers below. */
const getSession = cache(async (): Promise<{ status: "ok"; auth: Auth } | { status: "unauthorized" } | { status: "unavailable" }> => {
  const token = (await cookies()).get(COOKIE.session)?.value;
  if (!token) return { status: "unauthorized" };
  try {
    const valid = await validateSessionToken(token);
    if (!valid) return { status: "unauthorized" };
    return { status: "ok", auth: { ...valid, token } };
  } catch (error) {
    if (isDatabaseUnavailable(error)) return { status: "unavailable" };
    throw error;
  }
});

export const getCurrentUser = cache(async (): Promise<MeResult> => {
  const session = await getSession();
  if (session.status !== "ok") return session;
  try {
    return { status: "ok", user: await meFor(session.auth.user), impersonating: session.auth.session.kind === "impersonation" };
  } catch (error) {
    if (isDatabaseUnavailable(error)) return { status: "unavailable" };
    throw error;
  }
});

/**
 * For Server Components that call services taking an `Auth` (like the API routes do): the signed-in
 * user's session, after the same checks and redirects as requireUser.
 */
export async function requirePageAuth(roles?: Role[]): Promise<Auth> {
  await requireUser(roles);
  const session = await getSession();
  if (session.status !== "ok") throw new Error("The account service is not reachable right now.");
  return session.auth;
}

/**
 * For signed-in layouts and pages: the current user. Otherwise:
 * - not signed in, or the session ended (signed out on another device, expired): go through
 *   /auth/resume, which clears the cookies and sends the person to sign-in, then back here;
 * - database unavailable: throw, so the error page offers "Try again" (an outage is not a sign-out).
 * With `roles`, people with another role are sent to their own home.
 */
export async function requireUser(roles?: Role[]): Promise<Me> {
  const result = await getCurrentUser();
  if (result.status === "unavailable") throw new Error("The account service is not reachable right now.");
  if (result.status === "unauthorized") {
    const path = (await headers()).get(PATH_HEADER) ?? "/";
    redirect(`/auth/resume?next=${encodeURIComponent(path)}`);
  }
  const user = result.user;
  if (roles && !roles.includes(user.role)) redirect(roleHome[user.role]);
  return user;
}

/** An admin is viewing the app as the signed-in user. */
export async function isImpersonating(): Promise<boolean> {
  const result = await getCurrentUser();
  return result.status === "ok" && result.impersonating;
}
