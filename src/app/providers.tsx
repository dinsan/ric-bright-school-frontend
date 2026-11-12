"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api-client";
import { subscribePreferences } from "@/lib/preferences";

const SIGNED_IN_AREAS = /^\/(learn|teach|family|admin|account)(\/|$)/;

/**
 * A request from a signed-in page got 401. The gateway already tried to refresh, so the session is
 * probably over; but some endpoints may answer 401 for other reasons (a wrong current password), so
 * ask the gateway first. If the session really ended: sign in, then come back to this page.
 */
async function handleSessionEnd(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401) return;
  const { pathname, search } = window.location;
  if (!SIGNED_IN_AREAS.test(pathname)) return;
  const session = await authApi.session().catch(() => null);
  if (session && !session.user) {
    // A full page load on purpose: it drops everything cached for the session that ended.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/sign-in?next=${encodeURIComponent(pathname + search)}`);
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleSessionEnd }),
    mutationCache: new MutationCache({ onError: handleSessionEnd }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        // Client errors (4xx) will not fix themselves; only retry transient failures.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  // Keep the theme in sync on every page (OS dark-mode changes, changes made in other tabs),
  // not only on pages that happen to show a theme switcher.
  useEffect(() => subscribePreferences(() => {}), []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={400}>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
