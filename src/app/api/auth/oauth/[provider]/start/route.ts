import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_PROVIDERS, type OAuthIntent, type OAuthProvider } from "@/features/auth/contract";
import { writeOAuthCookie } from "@/server/auth/session";
import { notFound } from "@/server/http/errors";
import { isSecureRequest, publicOrigin } from "@/server/http/request";
import { type Params, route } from "@/server/http/route";
import { startOAuth } from "@/server/oauth/service";

/**
 * A full-page navigation from "Continue with Google / Microsoft / Apple" or "Link": sends the browser to
 * the provider. Query: next (a same-site path), intent (signin | signup | link), role (signup only).
 */
export const GET = route(async (request: NextRequest, { params }: Params<{ provider: string }>) => {
  const { provider } = await params;
  if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) throw notFound("That sign-in option");
  const query = request.nextUrl.searchParams;
  const intentParam = query.get("intent");
  const intent: OAuthIntent = intentParam === "link" || intentParam === "signup" ? intentParam : "signin";
  const roleParam = query.get("role");
  const role = roleParam === "parent" || roleParam === "teacher" ? roleParam : null;

  const started = await startOAuth(request, provider as OAuthProvider, { intent, next: query.get("next"), role });
  if ("signInFirst" in started) {
    return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent("/account/security")}`, publicOrigin(request)));
  }
  const response = NextResponse.redirect(started.url);
  writeOAuthCookie(response.cookies, started.state, isSecureRequest(request));
  return response;
});
