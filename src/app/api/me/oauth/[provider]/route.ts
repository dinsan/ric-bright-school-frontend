import type { NextRequest } from "next/server";
import { OAUTH_PROVIDERS, type OAuthProvider } from "@/features/auth/contract";
import { unlinkAccount } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { notFound } from "@/server/http/errors";
import { noContent, type Params, route } from "@/server/http/route";

export const DELETE = route(async (request: NextRequest, { params }: Params<{ provider: string }>) => {
  const auth = await requireAuth(request);
  const { provider } = await params;
  if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) throw notFound("That linked account");
  await unlinkAccount(auth, provider as OAuthProvider);
  return noContent();
});
