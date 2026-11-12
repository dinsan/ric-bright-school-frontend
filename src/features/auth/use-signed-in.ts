"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { gradeBandForGrade, setGradeBand } from "@/lib/preferences";
import { safeNextPath } from "@/lib/safe-redirect";
import { roleHome, type Me } from "./contract";
import { sessionKey } from "./session";

/**
 * What happens right after any successful sign-in: students get the reading level of their grade
 * (they can still change it in Display settings), the session is refreshed, and the browser goes to
 * the page they came for or their role's home.
 */
export function useSignedIn(next?: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async (user: Me | null) => {
    if (user?.role === "student" && user.grade_level) setGradeBand(gradeBandForGrade(user.grade_level));
    await queryClient.invalidateQueries({ queryKey: sessionKey });
    router.replace(safeNextPath(next) ?? (user ? roleHome[user.role] : "/"));
    router.refresh();
  };
}
