import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { clearSession, COOKIE, isSecureRequest, loadMe, publicOrigin, refreshTokens, writeSession } from "@/lib/server/session";

/**
 * A signed-in page found that the backend no longer accepts the access token (for example the
 * session was ended from another device). Server Components cannot change cookies, so they send
 * the browser here: refresh if the session is still valid, otherwise clear the cookies and go to
 * sign-in. Either way the browser comes back to `next`. Breaks the redirect loop that stale
 * cookies would otherwise cause between the page and the sign-in page.
 */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const next = safeNextPath(request.nextUrl.searchParams.get("next")) ?? "/";
  const refreshToken = request.cookies.get(COOKIE.refresh)?.value;

  const refreshed = refreshToken ? await refreshTokens(refreshToken) : ({ status: "rejected" } as const);
  if (refreshed.status === "unavailable") {
    return new NextResponse(
      "<!doctype html><meta charset=utf-8><title>Lumina</title><p style='font-family:sans-serif;padding:2rem'>Lumina can't reach its servers right now. <a href=''>Try again</a> in a moment.</p>",
      { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "30" } },
    );
  }
  if (refreshed.status === "ok") {
    const me = await loadMe(refreshed.tokens.access_token);
    if (me.status === "ok") {
      const response = NextResponse.redirect(new URL(next, origin));
      writeSession(response.cookies, refreshed.tokens, me.user.role, isSecureRequest(request));
      return response;
    }
  }
  const signIn = new URL("/sign-in", origin);
  signIn.searchParams.set("next", next);
  const response = NextResponse.redirect(signIn);
  clearSession(response.cookies);
  return response;
}
