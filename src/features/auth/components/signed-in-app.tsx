"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ChildSwitcher } from "@/features/family/components/child-switcher";
import { SearchButton } from "@/features/search/components/search-button";
import { authApi } from "../api";
import type { Me } from "../contract";
import { useSession } from "../session";

const roleNames = { student: "student", parent: "parent", teacher: "teacher", admin: "admin" } as const;

/** The signed-in area: the app shell for the user's role, fed by the session from the server. */
export function SignedInApp({ initialUser, impersonating, children }: { initialUser: Me; impersonating: boolean; children: ReactNode }) {
  const session = useSession({ user: initialUser, impersonating });
  const router = useRouter();
  const pathname = usePathname();
  const user = session.data?.user ?? initialUser;

  // The session ended (signed out in another tab, expired): back to sign-in, then back here.
  const ended = session.data !== undefined && session.data.user === null;
  useEffect(() => {
    if (ended) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [ended, pathname, router]);

  return (
    <AppShell
      role={user.role}
      user={{ name: user.display_name, avatarUrl: user.avatar_url }}
      banner={session.data?.impersonating ? <ImpersonationBanner user={user} /> : null}
      actions={
        <>
          <SearchButton compact />
          {user.role === "parent" && <ChildSwitcher activeChildId={user.active_child_id} />}
        </>
      }
    >
      {children}
    </AppShell>
  );
}

function ImpersonationBanner({ user }: { user: Me }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [stopping, setStopping] = useState(false);
  const stop = async () => {
    setStopping(true);
    try {
      await authApi.stopImpersonating();
      queryClient.clear();
      router.replace("/admin/users");
      router.refresh();
    } catch {
      setStopping(false);
      toast({ title: "Could not stop viewing", description: "Sign out, then sign in again as yourself.", tone: "danger" });
    }
  };
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b-2 border-line bg-accent px-gutter py-2 text-center text-accent-fg">
      <p className="flex items-center gap-2 font-bold">
        <Eye aria-hidden className="size-icon shrink-0" />
        You are viewing Lumina as {user.display_name} ({roleNames[user.role]}). What you do here is real.
      </p>
      <Button size="sm" loading={stopping} onClick={stop}>
        Stop viewing
      </Button>
    </div>
  );
}
