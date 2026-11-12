import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { MfaChallenge, Role, TokenResponse } from "@/features/auth/contract";
import { paths } from "@/features/auth/contract";
import {
  backendUrl,
  clearSession,
  COOKIE,
  isSecureRequest,
  loadMe,
  publicOrigin,
  refreshTokens,
  writeMfaToken,
  writeSession,
} from "./session";

/**
 * Forwards a browser request to the backend on behalf of the signed-in user. See docs/auth.md.
 * - Adds `Authorization: Bearer <access token>` from the httpOnly cookie.
 * - Refreshes the tokens once when the access token is missing or rejected (401).
 * - Catches tokens in ANY JSON response (sign-in, MFA, verification, reset...), stores them in
 *   cookies and removes them from the body; same for the MFA step token.
 * - Refuses cross-site state-changing requests (CSRF).
 */

const FORWARDED_REQUEST_HEADERS = ["accept", "accept-language", "content-type", "user-agent", "x-request-id"];
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition", "x-request-id", "retry-after", "cache-control"];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Browser paths that must never reach the backend through the proxy. */
const BLOCKED = new Set([paths.refresh]);

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message, details: [], request_id: null } }, { status });
}

/**
 * CSRF: state-changing requests must come from this site. The session cookies are SameSite=Lax, and
 * on top of that the Origin (or Referer) must match and the app's own header must be present.
 */
export function isSameSite(request: NextRequest): boolean {
  if (!MUTATING.has(request.method)) return true;
  if (request.headers.get("x-requested-with") !== "lumina") return false;
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

interface ForwardOptions {
  /** Contract path, e.g. "/me/sessions". */
  path: string;
  search?: string;
  method?: string;
  body?: string | null;
  contentType?: string | null;
}

interface BackendResult {
  response: Response;
  /** Tokens issued by a refresh during this call, to be written to cookies. */
  refreshed: TokenResponse | null;
  /** True when the refresh token was rejected: the session is over. */
  sessionEnded: boolean;
}

/** Calls the backend with the user's access token, refreshing once if needed. */
export async function callBackend(request: NextRequest, { path, search = "", method = "GET", body = null, contentType }: ForwardOptions): Promise<BackendResult> {
  let accessToken = request.cookies.get(COOKIE.access)?.value;
  const refreshToken = request.cookies.get(COOKIE.refresh)?.value;
  let refreshed: TokenResponse | null = null;
  let sessionEnded = false;

  const tryRefresh = async () => {
    if (!refreshToken || refreshed) return false;
    const result = await refreshTokens(refreshToken);
    if (result.status !== "ok") {
      // Only a rejected refresh ends the session; an unavailable backend must not sign anyone out.
      sessionEnded = result.status === "rejected";
      return false;
    }
    refreshed = result.tokens;
    accessToken = refreshed.access_token;
    return true;
  };

  if (!accessToken && refreshToken) await tryRefresh();

  const send = () => {
    const headers = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (contentType) headers.set("content-type", contentType);
    const ip = clientIp(request);
    if (ip) headers.set("x-forwarded-for", ip);
    if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
    return fetch(backendUrl(path, search), { method, headers, body, cache: "no-store", redirect: "manual" });
  };

  let response = await send();
  if (response.status === 401 && refreshToken && !refreshed && (await tryRefresh())) {
    response = await send();
  }
  return { response, refreshed, sessionEnded };
}

/** Turns a backend response into the browser response: strips and stores tokens, copies safe headers. */
export async function toBrowserResponse(request: NextRequest, { response, refreshed, sessionEnded }: BackendResult) {
  const secure = isSecureRequest(request);
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Redirects (OAuth start) are passed to the browser as they are.
  if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
    headers.set("location", response.headers.get("location")!);
    const redirect = new NextResponse(null, { status: response.status, headers });
    if (refreshed) writeSession(redirect.cookies, refreshed, roleHint(request), secure);
    return redirect;
  }

  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  let result: NextResponse;
  let issued: TokenResponse | null = null;
  let issuedRole: Role | null = null;
  let mfaToken: string | null = null;

  if (isJson && response.status !== 204) {
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    let body: unknown = data;
    if (data && typeof data === "object" && typeof data.access_token === "string" && typeof data.refresh_token === "string") {
      issued = data as unknown as TokenResponse;
      const rest = Object.fromEntries(
        Object.entries(data).filter(([key]) => !["access_token", "refresh_token", "token_type", "expires_in", "refresh_expires_in"].includes(key)),
      );
      // Tell the browser who signed in, so it can go to the right home page.
      const me = await loadMe(issued.access_token);
      if (me.status !== "ok") {
        // Tokens were issued but the account can't be used (turned off, for example): this is a
        // failed sign-in, not a session. Keep no cookies.
        return errorResponse(
          me.status === "unavailable" ? 503 : 403,
          me.status === "unavailable" ? "service_unavailable" : "account_unavailable",
          me.status === "unavailable"
            ? "Lumina can't finish signing you in right now. Try again in a moment."
            : "This account can't be used right now. Ask your school or contact Lumina support.",
        );
      }
      issuedRole = me.user.role;
      body = { ...rest, signed_in: true, user: me.user };
    } else if (data && typeof data === "object" && data.mfa_required === true && typeof data.mfa_token === "string") {
      mfaToken = (data as unknown as MfaChallenge).mfa_token;
      body = { mfa_required: true };
    }
    result = NextResponse.json(body, { status: response.status, headers });
  } else {
    result = new NextResponse(response.status === 204 ? null : response.body, { status: response.status, headers });
  }

  if (issued) {
    writeSession(result.cookies, issued, issuedRole, secure);
  } else if (refreshed) {
    writeSession(result.cookies, refreshed, roleHint(request), secure);
  }
  if (mfaToken) writeMfaToken(result.cookies, mfaToken, secure);
  if (sessionEnded) clearSession(result.cookies);
  return result;
}

function roleHint(request: NextRequest) {
  const value = request.cookies.get(COOKIE.hint)?.value;
  return value === "student" || value === "parent" || value === "teacher" || value === "admin" ? value : null;
}

/** The generic proxy used by app/api/[...path]. */
export async function proxyToBackend(request: NextRequest, path: string) {
  if (BLOCKED.has(path as never)) return errorResponse(404, "not_found", "Not found");
  if (!isSameSite(request)) return errorResponse(403, "cross_site_request", "This request must come from the Lumina site.");

  let body: string | null = null;
  if (!["GET", "HEAD"].includes(request.method)) body = await request.text();

  // The MFA step: add the step token that was kept server-side.
  if (path === paths.loginMfa) {
    const mfaToken = request.cookies.get(COOKIE.mfa)?.value;
    if (!mfaToken) return errorResponse(401, "mfa_expired", "Your sign-in took too long. Start again.");
    const parsed = safeJson(body);
    body = JSON.stringify({ ...parsed, mfa_token: mfaToken });
  }

  // OAuth start: tell the backend where to send the browser back to.
  let search = request.nextUrl.search;
  const oauthStart = /^\/auth\/oauth\/[^/]+\/start$/.test(path);
  if (oauthStart) {
    const params = new URLSearchParams(request.nextUrl.searchParams);
    const callback = new URL("/auth/callback", publicOrigin(request));
    callback.searchParams.set("provider", path.split("/")[3] ?? "");
    for (const key of ["next", "intent"]) {
      const value = params.get(key);
      if (value) callback.searchParams.set(key, value);
      params.delete(key);
    }
    params.set("redirect_uri", callback.toString());
    search = `?${params.toString()}`;
  }

  const result = await callBackend(request, {
    path,
    search,
    method: request.method,
    body,
    contentType: request.headers.get("content-type"),
  });
  // Some backends answer the OAuth start with {"authorization_url": "..."} instead of a redirect.
  if (oauthStart && result.response.ok && (result.response.headers.get("content-type") ?? "").includes("json")) {
    const data = (await result.response.clone().json().catch(() => ({}))) as { authorization_url?: string; url?: string };
    const target = data.authorization_url ?? data.url;
    if (target) return NextResponse.redirect(target, 302);
  }
  const browserResponse = await toBrowserResponse(request, result);

  // Account deleted: the session is gone too.
  if (path === paths.me && request.method === "DELETE" && result.response.ok) clearSession(browserResponse.cookies);
  return browserResponse;
}

function safeJson(text: string | null): Record<string, unknown> {
  try {
    const value = text ? JSON.parse(text) : {};
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export { errorResponse };
