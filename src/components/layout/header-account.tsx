"use client";

import { useQuery } from "@tanstack/react-query";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authApi } from "@/features/auth/api";
import { roleHome } from "@/features/auth/contract";
import { sessionKey, useSessionHint } from "@/features/auth/session";
import { UserMenu } from "./user-menu";

/**
 * Public header: "Sign in", or the account menu when signed in. Public pages are static, so the
 * server always renders "Sign in"; the readable session hint decides whether to ask who is signed in.
 */
export function HeaderAccount() {
  const hint = useSessionHint();
  const session = useQuery({ queryKey: sessionKey, queryFn: authApi.session, enabled: Boolean(hint), staleTime: 60_000 });
  const user = session.data?.user;
  if (!hint || (session.isFetched && !user)) {
    return (
      <ButtonLink href="/sign-in" size="sm" variant="secondary">
        Sign in
      </ButtonLink>
    );
  }
  if (!user) return <Skeleton className="size-control rounded-full" />;
  return <UserMenu user={{ name: user.display_name, avatarUrl: user.avatar_url }} role={user.role} homeHref={roleHome[user.role]} />;
}
