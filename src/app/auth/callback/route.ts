import { NextResponse, type NextRequest } from "next/server";
import { paths, roleHome, type OAuthProvider, type TokenResponse } from "@/features/auth/contract";
import { safeNextPath } from "@/lib/safe-redirect";
import { callBackend } from "@/lib/server/bff";
import { backendUrl, fetchMe, isSecureRequest, publicOrigin, writeSession } from "@/lib/server/session";

const PROVIDERS: OAuthProvider[] = ["google", "microsoft", "apple"];

/**
 * The backend sends the browser here after Google / Microsoft / Apple with a one-time code.
 * Signing in: exchange the code for tokens. Linking (intent=link): attach the account to the
 * signed-in user. See the OAuth note in features/auth/contract.ts.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const provider = params.get("provider") as OAuthProvider | null;
  const linking = params.get("intent") === "link";
  const origin = publicOrigin(request);
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (linking) {
    if (!code || !provider || !PROVIDERS.includes(provider) || params.get("error")) return to("/account/security?link=failed");
    const { response } = await callBackend(request, {
      path: paths.linkAccount(provider),
      method: "POST",
      body: JSON.stringify({ code }),
      contentType: "application/json",
    });
    return to(`/account/security?link=${response.ok ? "done" : "failed"}&provider=${provider}`);
  }

  if (!code || params.get("error")) return to("/sign-in?error=oauth");
  const response = await fetch(backendUrl(paths.oauthExchange), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code }),
    cache: "no-store",
  }).catch(() => null);
  const tokens = response?.ok ? ((await response.json()) as Partial<TokenResponse>) : null;
  if (!tokens?.access_token || !tokens.refresh_token) return to("/sign-in?error=oauth");

  const user = await fetchMe(tokens.access_token);
  const destination = safeNextPath(params.get("next")) ?? (user ? roleHome[user.role] : "/");
  const result = to(destination);
  writeSession(result.cookies, tokens as TokenResponse, user?.role ?? null, isSecureRequest(request));
  return result;
}
