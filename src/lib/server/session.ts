import "server-only";

import type { NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { paths, roleHome, type Me, type Role, type TokenResponse } from "@/features/auth/contract";
import { env } from "@/lib/env";

/**
 * Server-side session handling (the "backend for frontend"). See docs/auth.md.
 *
 * The backend issues an access token and a refresh token. The browser never sees either: they are
 * kept in httpOnly cookies set by this app, and every call to the backend goes through the server
 * (route handlers, the proxy, Server Components), which adds the Authorization header.
 */

export const COOKIE = {
  /** Access token. Expires with the token, so a missing cookie means "refresh first". */
  access: "lumina_at",
  /** Refresh token. */
  refresh: "lumina_rt",
  /** Not secret, readable by JavaScript: the signed-in role, for instant UI (header, redirects). Never trusted for access. */
  hint: "lumina_session",
  /** MFA step token between /auth/login and /auth/login/mfa. */
  mfa: "lumina_mfa",
  /** The admin's own refresh token while impersonating someone. */
  impersonator: "lumina_imp",
} as const;

const DEFAULT_ACCESS_SECONDS = 15 * 60;
const DEFAULT_REFRESH_SECONDS = 30 * 24 * 60 * 60;
const MFA_SECONDS = 10 * 60;

export const API_PREFIX = process.env.API_PREFIX ?? "/api/v1";

/** Absolute backend URL for a contract path ("/me" -> http://api:8000/api/v1/me). */
export function backendUrl(path: string, search = ""): string {
  return `${env.serverApiUrl.replace(/\/$/, "")}${API_PREFIX}${path}${search}`;
}

// --- Cookie writing -------------------------------------------------------------------------------

interface CookieWriter {
  set(name: string, value: string, options?: Record<string, unknown>): unknown;
  delete(name: string): unknown;
}

/** Secure cookies on HTTPS (also behind a TLS-terminating proxy); plain HTTP for local development. */
export function isSecureRequest(request: Request | NextRequest): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  const forwarded = request.headers.get("x-forwarded-proto");
  return (forwarded ?? new URL(request.url).protocol.replace(":", "")) === "https";
}

function base(secure: boolean) {
  return { path: "/", sameSite: "lax" as const, secure };
}

/** Seconds until a JWT expires, if the token is a JWT with `exp`. The signature is not checked: this only sets a cookie lifetime. */
export function jwtSecondsLeft(token: string): number | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof exp === "number" ? Math.max(0, Math.floor(exp - Date.now() / 1000)) : undefined;
  } catch {
    return undefined;
  }
}

export function writeSession(jar: CookieWriter, tokens: TokenResponse, role: Role | null, secure: boolean) {
  const accessSeconds = tokens.expires_in ?? jwtSecondsLeft(tokens.access_token) ?? DEFAULT_ACCESS_SECONDS;
  const refreshSeconds = tokens.refresh_expires_in ?? jwtSecondsLeft(tokens.refresh_token) ?? DEFAULT_REFRESH_SECONDS;
  // Expire the access cookie a little early so it is refreshed before the backend rejects it.
  jar.set(COOKIE.access, tokens.access_token, { ...base(secure), httpOnly: true, maxAge: Math.max(1, accessSeconds - 30) });
  jar.set(COOKIE.refresh, tokens.refresh_token, { ...base(secure), httpOnly: true, maxAge: refreshSeconds });
  jar.set(COOKIE.hint, role ?? "signed-in", { ...base(secure), httpOnly: false, maxAge: refreshSeconds });
  jar.delete(COOKIE.mfa);
}

export function writeMfaToken(jar: CookieWriter, token: string, secure: boolean) {
  jar.set(COOKIE.mfa, token, { ...base(secure), httpOnly: true, maxAge: MFA_SECONDS });
}

export function clearSession(jar: CookieWriter) {
  for (const name of [COOKIE.access, COOKIE.refresh, COOKIE.hint, COOKIE.mfa, COOKIE.impersonator]) jar.delete(name);
}

// --- Backend calls --------------------------------------------------------------------------------

export type RefreshResult = { status: "ok"; tokens: TokenResponse } | { status: "rejected" } | { status: "unavailable" };

/**
 * Exchanges a refresh token for new tokens. "rejected" means the session is over (sign in again);
 * "unavailable" means the backend could not be reached or failed: keep the session, try later.
 * Never treat an outage as a sign-out.
 */
export async function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await fetch(backendUrl(paths.refresh), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (response.status >= 500 || response.status === 429) return { status: "unavailable" };
    if (!response.ok) return { status: "rejected" };
    const body = (await response.json()) as Partial<TokenResponse>;
    return body.access_token && body.refresh_token ? { status: "ok", tokens: body as TokenResponse } : { status: "rejected" };
  } catch {
    return { status: "unavailable" };
  }
}

export type MeResult = { status: "ok"; user: Me } | { status: "unauthorized" } | { status: "unavailable" };

/** GET /me with an access token, telling "not signed in" apart from "backend unavailable". */
export async function loadMe(accessToken: string): Promise<MeResult> {
  try {
    const response = await fetch(backendUrl(paths.me), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (response.ok) return { status: "ok", user: (await response.json()) as Me };
    return response.status === 401 || response.status === 403 ? { status: "unauthorized" } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

/** GET /me; null when it does not answer with a user. */
export async function fetchMe(accessToken: string): Promise<Me | null> {
  const result = await loadMe(accessToken);
  return result.status === "ok" ? result.user : null;
}

// --- Server Components ----------------------------------------------------------------------------

/**
 * The signed-in user for this request. Deduplicated per request. The proxy (src/proxy.ts)
 * refreshes expired access tokens before pages render, so this only reads.
 */
export const getCurrentUser = cache(async (): Promise<MeResult> => {
  const accessToken = (await cookies()).get(COOKIE.access)?.value;
  return accessToken ? loadMe(accessToken) : { status: "unauthorized" };
});

export async function isImpersonating(): Promise<boolean> {
  return (await cookies()).has(COOKIE.impersonator);
}

/** Request header set by the proxy: the path being rendered, so server code can send people back to it. */
export const PATH_HEADER = "x-lumina-path";

/**
 * For signed-in layouts and pages: the current user. Otherwise:
 * - not signed in, or the backend refused the token (for example the session was ended on another
 *   device): go through /auth/resume, which refreshes or clears the cookies and comes back here;
 * - backend unavailable: throw, so the error page offers "Try again" (an outage is not a sign-out).
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

/**
 * The site's public origin, for URLs sent back to the browser (redirects, the OAuth callback).
 * Not request.url: the standalone server (Docker) reports the address it listens on (0.0.0.0).
 * APP_URL wins when set (recommended in production); otherwise the (forwarded) Host header.
 */
export function publicOrigin(request: Request | NextRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}
