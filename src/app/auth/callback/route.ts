import { NextResponse, type NextRequest } from "next/server";
import { signInCookies } from "@/server/auth/sign-in";
import { COOKIE } from "@/server/auth/session";
import { publicOrigin } from "@/server/http/request";
import { finishOAuth } from "@/server/oauth/service";

/**
 * Google / Microsoft / Apple send the browser back here (see src/server/oauth/service.ts): sign in,
 * sign up, or link the account, then go on to the right page.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = publicOrigin(request);
  try {
    const result = await finishOAuth(
      request,
      { code: params.get("code"), state: params.get("state"), error: params.get("error"), name: params.get("name") },
      request.cookies.get(COOKIE.oauth)?.value,
    );
    const response = NextResponse.redirect(new URL(result.redirect, origin));
    if (result.signIn) signInCookies(response.cookies, result.signIn, request);
    response.cookies.delete(COOKIE.oauth);
    return response;
  } catch (error) {
    console.error("[oauth] callback failed", error);
    const response = NextResponse.redirect(new URL("/sign-in?error=oauth", origin));
    response.cookies.delete(COOKIE.oauth);
    return response;
  }
}

/**
 * Apple answers with a cross-site form POST (response_mode=form_post), which doesn't carry SameSite=Lax
 * cookies. Turn it into a same-site GET navigation (303), which does, and handle it above. Apple sends
 * the person's name only here and only once, so it is passed along.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const target = new URL("/auth/callback", publicOrigin(request));
  for (const key of ["code", "state", "error"]) {
    const value = form?.get(key);
    if (typeof value === "string") target.searchParams.set(key, value);
  }
  const user = form?.get("user");
  if (typeof user === "string") {
    try {
      const { name } = JSON.parse(user) as { name?: { firstName?: string; lastName?: string } };
      const full = [name?.firstName, name?.lastName].filter(Boolean).join(" ").trim();
      if (full) target.searchParams.set("name", full.slice(0, 80));
    } catch {
      // No name: the email's first part is used instead.
    }
  }
  return NextResponse.redirect(target, 303);
}
