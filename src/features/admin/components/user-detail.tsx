"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Eye, ShieldOff, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import type { AdminUser, Role } from "@/features/auth/contract";
import { roleHome } from "@/features/auth/contract";
import { formatDate } from "@/lib/format";
import { adminApi } from "../api";
import { roleLabels, roleTones } from "./users-browser";

type Confirm = { title: string; description: ReactNode; label: string; done?: string; danger?: boolean; run: () => Promise<unknown> };

/** One user, with the admin actions: role, on/off, teacher verification, MFA reset, impersonation. */
export function UserDetail({ userId, selfId }: { userId: string; selfId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const key = ["admin", "user", userId];
  const user = useQuery({ queryKey: key, queryFn: () => adminApi.user(userId) });
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [role, setRole] = useState<Role | "">("");

  const run = useMutation({
    mutationFn: (action: Confirm) => action.run(),
    onSuccess: (result) => {
      if (result && typeof result === "object" && "id" in result) queryClient.setQueryData(key, result as AdminUser);
      else queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setConfirm(null);
    },
  });

  if (user.isPending) return <Skeleton className="h-64 w-full" />;
  if (user.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="This user didn't load"
        description={user.error.message}
        action={<Button onClick={() => user.refetch()}>Try again</Button>}
      />
    );
  }
  const u = user.data;
  const isSelf = u.id === selfId;
  const open = (action: Confirm) => {
    run.reset();
    setConfirm(action);
  };

  return (
    <div className="grid gap-6">
      <Card>
        <dl className="grid gap-4 text-small sm:grid-cols-2">
          <Fact label="Role">
            <Badge tone={roleTones[u.role]}>{roleLabels[u.role]}</Badge>
          </Fact>
          <Fact label="Status">{u.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Turned off</Badge>}</Fact>
          <Fact label="Email">{u.email ? `${u.email}${u.email_verified ? "" : " (not confirmed)"}` : "None"}</Fact>
          <Fact label="Username">{u.username ?? "None"}</Fact>
          <Fact label="Two-step verification">{u.mfa_enabled ? "On" : "Off"}</Fact>
          {u.role === "teacher" && <Fact label="Teacher verification">{u.teacher_verified ? "Verified" : "Not verified"}</Fact>}
          <Fact label="Joined">{formatDate(u.created_at)}</Fact>
          <Fact label="Last sign-in">{u.last_login_at ? formatDate(u.last_login_at) : "Never"}</Fact>
        </dl>
      </Card>

      <Card>
        <h2 className="text-heading">Actions</h2>
        {isSelf && <Alert tone="info" title="This is your own account">Some actions are not available for yourself.</Alert>}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end">
          <FormField label="Change role">
            <Select value={role || u.role} onChange={(event) => setRole(event.target.value as Role)} disabled={isSelf}>
              {(Object.keys(roleLabels) as Role[]).map((value) => (
                <option key={value} value={value}>
                  {roleLabels[value]}
                </option>
              ))}
            </Select>
          </FormField>
          <Button
            disabled={isSelf || !role || role === u.role}
            onClick={() =>
              open({
                title: `Make ${u.display_name} a ${roleLabels[role as Role].toLowerCase()}?`,
                description: "What they can see and do changes straight away.",
                label: "Change role",
                done: "Role changed",
                run: () => adminApi.update(u.id, { role: role as Role }).then((result) => (setRole(""), result)),
              })
            }
          >
            <UserCog aria-hidden />
            Change role
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          {u.role === "teacher" && (
            <Button
              onClick={() =>
                open({
                  title: u.teacher_verified ? `Remove ${u.display_name}'s verification?` : `Verify ${u.display_name} as a teacher?`,
                  description: u.teacher_verified
                    ? "They keep their account but lose verified-teacher features until verified again."
                    : "Check their school and profile first. Verified teachers can run classes for children.",
                  label: u.teacher_verified ? "Remove verification" : "Verify teacher",
                  done: u.teacher_verified ? "Verification removed" : "Teacher verified",
                  run: () => adminApi.verifyTeacher(u.id, !u.teacher_verified),
                })
              }
            >
              <BadgeCheck aria-hidden />
              {u.teacher_verified ? "Remove teacher verification" : "Verify teacher"}
            </Button>
          )}
          {u.mfa_enabled && (
            <Button
              onClick={() =>
                open({
                  title: `Reset two-step verification for ${u.display_name}?`,
                  description: "Only do this after confirming who they are. Their account will be protected by the password alone until they set it up again.",
                  label: "Reset",
                  done: "Two-step verification reset",
                  danger: true,
                  run: () => adminApi.resetMfa(u.id),
                })
              }
            >
              <ShieldOff aria-hidden />
              Reset two-step verification
            </Button>
          )}
          {!isSelf && u.role !== "admin" && u.is_active && (
            <Button
              onClick={() =>
                open({
                  title: `View Lumina as ${u.display_name}?`,
                  description: "For support only. You see exactly what they see, for a limited time, and anything you do is real and recorded.",
                  label: "Start viewing",
                  run: async () => {
                    const result = await adminApi.impersonate(u.id);
                    queryClient.clear();
                    router.replace(result.user ? roleHome[result.user.role] : "/");
                    router.refresh();
                    return null;
                  },
                })
              }
            >
              <Eye aria-hidden />
              View as this user
            </Button>
          )}
          {!isSelf && (
            <Button
              variant={u.is_active ? "danger" : "secondary"}
              onClick={() =>
                open({
                  title: u.is_active ? `Turn off ${u.display_name}'s account?` : `Turn ${u.display_name}'s account back on?`,
                  description: u.is_active ? "They are signed out everywhere and can't sign in until the account is turned back on." : "They can sign in again.",
                  label: u.is_active ? "Turn off" : "Turn on",
                  done: u.is_active ? "Account turned off" : "Account turned back on",
                  danger: u.is_active,
                  run: () => adminApi.update(u.id, { is_active: !u.is_active }),
                })
              }
            >
              {u.is_active ? "Turn off account" : "Turn account back on"}
            </Button>
          )}
        </div>
      </Card>

      <Dialog open={confirm !== null} onOpenChange={(next) => !next && setConfirm(null)}>
        {confirm && (
          <DialogContent title={confirm.title} description={confirm.description}>
            {run.isError && (
              <Alert tone="danger" role="alert" title="That didn't work">
                {run.error.message}
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button>Cancel</Button>
              </DialogClose>
              <Button
                variant={confirm.danger ? "danger" : "primary"}
                loading={run.isPending}
                onClick={() =>
                  run.mutate(confirm, {
                    onSuccess: () => confirm.done && toast({ title: confirm.done, tone: "success" }),
                  })
                }
              >
                {confirm.label}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="font-bold text-fg-muted">{label}</dt>
      <dd className="text-body wrap-break-word">{children}</dd>
    </div>
  );
}
