import type { OAuthProviders } from "@/features/auth/contract";
import { configuredProviders } from "@/server/oauth/providers";
import { json, route } from "@/server/http/route";

export const GET = route(() => json<OAuthProviders>({ providers: configuredProviders() }));
