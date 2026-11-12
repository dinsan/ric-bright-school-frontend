"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionKey } from "@/features/auth/session";
import { familyApi } from "./api";

export const childrenKey = ["family", "children"] as const;

export function useChildren(enabled = true) {
  return useQuery({ queryKey: childrenKey, queryFn: familyApi.children, enabled });
}

export function useSetActiveChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: familyApi.setActiveChild,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKey });
      queryClient.invalidateQueries({ queryKey: childrenKey });
    },
  });
}
