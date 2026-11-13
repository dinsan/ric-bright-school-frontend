"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { authApi, type SessionPayload } from "./api";
import type { Me } from "./contract";

export const sessionKey = ["session"] as const;

/** The signed-in user (or null), from /api/session. `initial` comes from the server in signed-in areas. */
export function useSession(initial?: SessionPayload) {
  return useQuery({
    queryKey: sessionKey,
    queryFn: authApi.session,
    initialData: initial,
    staleTime: 60_000,
  });
}

/** The signed-in user, for components that only render inside signed-in areas. */
export function useUser(): Me | null {
  return useSession().data?.user ?? null;
}

/**
 * The role from the readable session hint cookie: lets public pages show "Sign in" or the account
 * menu without waiting for a request. UI only; never used for access decisions.
 */
export function useSessionHint(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => document.cookie.match(/(?:^|;\s*)lumina_session=([^;]+)/)?.[1] ?? null,
    () => null,
  );
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: authApi.signOut,
    onSettled: () => {
      queryClient.clear();
      router.replace("/");
      router.refresh();
    },
  });
}
