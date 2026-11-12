"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Me } from "@/features/auth/contract";
import { sessionKey } from "@/features/auth/session";
import type { SessionPayload } from "@/features/auth/api";
import { accountApi } from "./api";

export const accountKeys = {
  sessions: ["account", "sessions"] as const,
  linked: ["account", "linked"] as const,
};

/** After a change to the account: show the new data everywhere at once. */
export function useApplyMe() {
  const queryClient = useQueryClient();
  return (me: Me) =>
    queryClient.setQueryData<SessionPayload>(sessionKey, (current) => ({ impersonating: current?.impersonating ?? false, user: me }));
}

export function useRefreshSession() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: sessionKey });
}

export function useSessions() {
  return useQuery({ queryKey: accountKeys.sessions, queryFn: accountApi.sessions });
}

export function useEndSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountApi.endSession,
    onSettled: () => queryClient.invalidateQueries({ queryKey: accountKeys.sessions }),
  });
}

export function useEndOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountApi.endOtherSessions,
    onSettled: () => queryClient.invalidateQueries({ queryKey: accountKeys.sessions }),
  });
}

export function useLinkedAccounts(enabled = true) {
  return useQuery({ queryKey: accountKeys.linked, queryFn: accountApi.linkedAccounts, enabled });
}
