"use client";

import { House, LogOut, Settings2, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GradeBandSettings, ThemeSettings } from "@/components/theme/display-settings";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppRole } from "@/config/navigation";
import { useSignOut } from "@/features/auth/session";

export interface AppUser {
  name: string;
  avatarUrl?: string | null;
}

/** `homeHref` adds a link back to the signed-in area (used in the public header). */
export function UserMenu({ user, role, homeHref }: { user: AppUser; role: AppRole; homeHref?: string }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const signOut = useSignOut();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inline-flex size-control items-center justify-center rounded-full">
            {/* Named by hidden text rather than aria-label, so the name is built from the content. */}
            <span className="sr-only">Account menu for {user.name}</span>
            <Avatar name={user.name} src={user.avatarUrl} size="md" decorative />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
          {homeHref && (
            <DropdownMenuItem asChild>
              <Link href={homeHref}>
                <House aria-hidden />
                My Lumina
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/account">
              <UserRound aria-hidden />
              Account settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings2 aria-hidden />
            Display settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" disabled={signOut.isPending} onSelect={() => signOut.mutate()}>
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent title="Display settings" description="Saved on this device.">
          <div className="grid gap-6">
            <ThemeSettings />
            {/* Only students pick a reading level; it will come from their profile. */}
            {role === "student" && <GradeBandSettings />}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="primary">Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
