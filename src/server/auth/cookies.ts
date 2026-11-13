import "server-only";

import type { Role } from "@/features/auth/contract";

/**
 * Cookie names, lifetimes and writers for sessions. Free of database code, so the proxy (src/proxy.ts)
 * can import it without pulling the database driver into its bundle.
 */

export const COOKIE = {
  /** The session token. httpOnly. */
  session: "lumina_sid",
  /** Not secret, readable by JavaScript: the signed-in role, for instant UI (header, redirects). Never trusted for access. */
  hint: "lumina_session",
  /** The MFA step between the password and the code. httpOnly, 10 minutes. */
  mfa: "lumina_mfa",
  /** The admin's own session token while viewing as someone else. httpOnly. */
  impersonator: "lumina_imp",
  /** OAuth state, binding the provider's answer to this browser. httpOnly, 10 minutes. */
  oauth: "lumina_oauth",
} as const;

const DAY = 24 * 60 * 60;
/** Standard sessions: 30 days, extended while in use. */
export const SESSION_SECONDS = 30 * DAY;
/** Picture sign-in on a shared classroom device: one school day, not extended. */
export const CLASSROOM_SESSION_SECONDS = 8 * 60 * 60;
/** An admin viewing as someone: one hour, not extended. */
export const IMPERSONATION_SESSION_SECONDS = 60 * 60;
export const MFA_SECONDS = 10 * 60;

interface CookieWriter {
  set(name: string, value: string, options?: Record<string, unknown>): unknown;
  delete(name: string): unknown;
}

function base(secure: boolean) {
  return { path: "/", sameSite: "lax" as const, secure };
}

/** Stores a new session in the browser: the token (httpOnly) and the role hint (readable). */
export function writeSessionCookies(jar: CookieWriter, token: string, role: Role, secure: boolean, maxAge = SESSION_SECONDS) {
  jar.set(COOKIE.session, token, { ...base(secure), httpOnly: true, maxAge });
  jar.set(COOKIE.hint, role, { ...base(secure), httpOnly: false, maxAge });
  jar.delete(COOKIE.mfa);
}

export function writeMfaCookie(jar: CookieWriter, token: string, secure: boolean) {
  jar.set(COOKIE.mfa, token, { ...base(secure), httpOnly: true, maxAge: MFA_SECONDS });
}

export function writeImpersonatorCookie(jar: CookieWriter, adminToken: string, secure: boolean) {
  jar.set(COOKIE.impersonator, adminToken, { ...base(secure), httpOnly: true, maxAge: IMPERSONATION_SESSION_SECONDS });
}

export function writeOAuthCookie(jar: CookieWriter, state: string, secure: boolean) {
  jar.set(COOKIE.oauth, state, { ...base(secure), httpOnly: true, maxAge: MFA_SECONDS });
}

export function clearSessionCookies(jar: CookieWriter) {
  for (const name of [COOKIE.session, COOKIE.hint, COOKIE.mfa, COOKIE.impersonator]) jar.delete(name);
}

export function roleFromHint(value: string | undefined | null): Role | null {
  return value === "student" || value === "parent" || value === "teacher" || value === "admin" ? value : null;
}

/** Request header set by the proxy: the path being rendered, so server code can send people back to it. */
export const PATH_HEADER = "x-lumina-path";
