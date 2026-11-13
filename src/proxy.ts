import { NextResponse, type NextRequest } from "next/server";
import { roleHome } from "@/features/auth/contract";
import { safeNextPath } from "@/lib/safe-redirect";
import { COOKIE, PATH_HEADER, roleFromHint, SESSION_SECONDS } from "@/server/auth/cookies";
import { isSecureRequest, publicOrigin } from "@/server/http/request";

/**
 * Runs before pages render (Next.js "proxy", formerly middleware). Optimistic checks only: it looks at
 * cookies and never trusts them for access; the (app) layouts check the session in the database.
 * 1. Sends signed-out visitors of signed-in areas to sign-in, remembering where they were going.
 * 2. Sends signed-in visitors of the sign-in / sign-up pages to their home.
 * 3. Keeps the session cookie alive while the person uses the site. The database session slides on use
 *    (src/server/auth/session.ts), but Server Components can't set cookies, so the cookie's lifetime is
 *    renewed here on page loads. The database stays the authority: an ended session is refused there.
 */

const SIGNED_IN_AREAS = ["/learn", "/teach", "/family", "/admin", "/account"];
const SIGNED_OUT_PAGES = ["/sign-in", "/sign-up"];

const startsWithAny = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(COOKIE.session)?.value;
  const role = roleFromHint(request.cookies.get(COOKIE.hint)?.value);
  const signedIn = Boolean(token);

  if (!signedIn && startsWithAny(pathname, SIGNED_IN_AREAS)) {
    const signIn = new URL("/sign-in", publicOrigin(request));
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  if (signedIn && role && startsWithAny(pathname, SIGNED_OUT_PAGES)) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next")) ?? roleHome[role];
    return NextResponse.redirect(new URL(next, publicOrigin(request)));
  }

  // Tell pages which path they render (for "sign in, then come back here").
  request.headers.set(PATH_HEADER, `${pathname}${search}`);
  const response = NextResponse.next({ request: { headers: request.headers } });

  // Only on GET page loads: a POST (Server Action) may have just replaced the session cookie.
  if (token && role && request.method === "GET" && !request.cookies.has(COOKIE.impersonator)) {
    const options = { path: "/", sameSite: "lax" as const, secure: isSecureRequest(request), maxAge: SESSION_SECONDS };
    response.cookies.set(COOKIE.session, token, { ...options, httpOnly: true });
    response.cookies.set(COOKIE.hint, role, { ...options, httpOnly: false });
  }
  return response;
}

export const config = {
  // Pages only: not the API, the OAuth callback, session recovery, Next.js assets or files.
  matcher: ["/((?!api/|auth/callback|auth/resume|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
