import { NextResponse, type NextRequest } from "next/server";
import { roleHome, type Role, type TokenResponse } from "@/features/auth/contract";
import { safeNextPath } from "@/lib/safe-redirect";
import { clearSession, COOKIE, isSecureRequest, PATH_HEADER, publicOrigin, refreshTokens, writeSession } from "@/lib/server/session";

/**
 * Runs before pages render (Next.js "proxy", formerly middleware). Optimistic checks only: it looks
 * at cookies, never trusts them for access (the (app) layouts check the real user with the backend).
 * 1. Refreshes an expired access token, so Server Components always get a valid one.
 * 2. Sends signed-out visitors of signed-in areas to sign-in, remembering where they were going.
 * 3. Sends signed-in visitors of the sign-in / sign-up pages to their home.
 */

const SIGNED_IN_AREAS = ["/learn", "/teach", "/family", "/admin", "/account"];
const SIGNED_OUT_PAGES = ["/sign-in", "/sign-up"];

const startsWithAny = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

function roleFromHint(value: string | undefined): Role | null {
  return value === "student" || value === "parent" || value === "teacher" || value === "admin" ? value : null;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(COOKIE.access)?.value;
  const refreshToken = request.cookies.get(COOKIE.refresh)?.value;
  const role = roleFromHint(request.cookies.get(COOKIE.hint)?.value);

  let refreshed: TokenResponse | null = null;
  let sessionEnded = false;
  let unavailable = false;
  if (!accessToken && refreshToken) {
    const result = await refreshTokens(refreshToken);
    if (result.status === "ok") refreshed = result.tokens;
    sessionEnded = result.status === "rejected";
    unavailable = result.status === "unavailable";
  }
  // Backend down: keep the session (the page shows "Try again"), never treat it as signed out.
  const signedIn = Boolean(accessToken || refreshed || unavailable);

  // Tell pages which path they render (for "sign in, then come back here").
  request.headers.set(PATH_HEADER, `${pathname}${search}`);

  if (!signedIn && startsWithAny(pathname, SIGNED_IN_AREAS)) {
    const signIn = new URL("/sign-in", publicOrigin(request));
    signIn.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(signIn);
    if (sessionEnded) clearSession(redirect.cookies);
    return redirect;
  }

  if (signedIn && role && startsWithAny(pathname, SIGNED_OUT_PAGES)) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next")) ?? roleHome[role];
    return NextResponse.redirect(new URL(next, publicOrigin(request)));
  }

  if (refreshed) {
    // Give this request the new token, so the page renders signed in...
    request.cookies.set(COOKIE.access, refreshed.access_token);
    const response = NextResponse.next({ request: { headers: request.headers } });
    // ...and store the new tokens in the browser.
    writeSession(response.cookies, refreshed, role, isSecureRequest(request));
    return response;
  }
  const response = NextResponse.next({ request: { headers: request.headers } });
  if (sessionEnded) clearSession(response.cookies);
  return response;
}

export const config = {
  // Pages only: not the API gateway, the OAuth callback, Next.js assets or files.
  matcher: ["/((?!api/|auth/callback|auth/resume|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
