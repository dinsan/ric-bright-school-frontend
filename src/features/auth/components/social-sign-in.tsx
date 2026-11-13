"use client";

import { useQuery } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { authApi, oauthStartUrl } from "../api";
import type { OAuthIntent, OAuthProvider } from "../contract";

export const providerNames: Record<OAuthProvider, string> = { google: "Google", microsoft: "Microsoft", apple: "Apple" };

/**
 * "Continue with Google / Microsoft / Apple" for the providers the server has credentials for. On the
 * sign-up page (intent="signup") a new account gets the role chosen in the form; until one is chosen
 * the buttons explain that first.
 */
export function SocialSignIn({
  next,
  label = "Continue with",
  intent = "signin",
  role = null,
}: {
  next?: string | null;
  label?: string;
  intent?: Exclude<OAuthIntent, "link">;
  role?: "parent" | "teacher" | null;
}) {
  const providers = useQuery({ queryKey: ["auth", "providers"], queryFn: authApi.providers, staleTime: 10 * 60_000, retry: false });
  const list = providers.data?.providers ?? [];
  if (list.length === 0) return null;
  const needsRole = intent === "signup" && !role;
  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-3 text-small text-fg-muted before:h-0.5 before:flex-1 before:bg-line-subtle after:h-0.5 after:flex-1 after:bg-line-subtle">
        or
      </p>
      {needsRole && <p className="text-small text-fg-muted">Choose parent or teacher above first.</p>}
      {list.map((provider) =>
        needsRole ? (
          <Button key={provider} disabled className="w-full">
            {label} {providerNames[provider] ?? provider}
          </Button>
        ) : (
          // A full page navigation: this app's server sends the browser on to the provider.
          <a key={provider} href={oauthStartUrl(provider, { next, intent, role })} className={buttonVariants({ variant: "secondary" }, "w-full")}>
            {label} {providerNames[provider] ?? provider}
          </a>
        ),
      )}
    </div>
  );
}
