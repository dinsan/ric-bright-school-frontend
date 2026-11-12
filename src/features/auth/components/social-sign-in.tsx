"use client";

import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/button";
import { authApi, oauthStartUrl } from "../api";
import type { OAuthProvider } from "../contract";

export const providerNames: Record<OAuthProvider, string> = { google: "Google", microsoft: "Microsoft", apple: "Apple" };

/** "Continue with Google / Microsoft / Apple" for the providers the backend is configured with. */
export function SocialSignIn({ next, label = "Continue with" }: { next?: string | null; label?: string }) {
  const providers = useQuery({ queryKey: ["auth", "providers"], queryFn: authApi.providers, staleTime: 10 * 60_000, retry: false });
  const list = providers.data?.providers ?? [];
  if (list.length === 0) return null;
  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-3 text-small text-fg-muted before:h-0.5 before:flex-1 before:bg-line-subtle after:h-0.5 after:flex-1 after:bg-line-subtle">
        or
      </p>
      {list.map((provider) => (
        // A full page navigation: the gateway sends the browser on to the provider.
        <a key={provider} href={oauthStartUrl(provider, { next })} className={buttonVariants({ variant: "secondary" }, "w-full")}>
          {label} {providerNames[provider] ?? provider}
        </a>
      ))}
    </div>
  );
}
