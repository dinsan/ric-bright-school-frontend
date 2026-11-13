import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { isDatabaseUnavailable } from "@/server/db";
import { clearSessionCookies, COOKIE, validateSessionToken } from "@/server/auth/session";
import { publicOrigin } from "@/server/http/request";

/**
 * A signed-in page found no valid session (ended on another device, expired, account turned off).
 * Server Components can't change cookies, so they send the browser here: if the session is in fact
 * valid, go back; otherwise clear the cookies and go to sign-in, then back to `next`. This breaks the
 * redirect loop stale cookies would otherwise cause between the page and the sign-in page.
 */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const next = safeNextPath(request.nextUrl.searchParams.get("next")) ?? "/";
  try {
    const valid = await validateSessionToken(request.cookies.get(COOKIE.session)?.value);
    if (valid) return NextResponse.redirect(new URL(next, origin));
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    return new NextResponse(
      "<!doctype html><meta charset=utf-8><title>Lumina</title><p style='font-family:sans-serif;padding:2rem'>Lumina can't reach its servers right now. <a href=''>Try again</a> in a moment.</p>",
      { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "30" } },
    );
  }
  const signIn = new URL("/sign-in", origin);
  signIn.searchParams.set("next", next);
  const response = NextResponse.redirect(signIn);
  clearSessionCookies(response.cookies);
  return response;
}
