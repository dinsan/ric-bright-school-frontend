"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Role } from "@/features/auth/contract";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { adminApi } from "../api";

const PAGE_SIZE = 20;
const ROLES: Role[] = ["student", "parent", "teacher", "admin"];
export const roleLabels: Record<Role, string> = { student: "Student", parent: "Parent", teacher: "Teacher", admin: "Admin" };
export const roleTones = { student: "accent", parent: "info", teacher: "middle", admin: "neutral" } as const;

/** Admin user search. State lives in the URL (?q=&role=&page=) so searches can be shared and the back button works. */
export function UsersBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const role = (ROLES as string[]).includes(params.get("role") ?? "") ? (params.get("role") as Role) : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [text, setText] = useState(q);

  const go = (next: { q?: string; role?: string; page?: number }) => {
    const search = new URLSearchParams();
    const merged = { q, role, page: 1, ...next };
    if (merged.q) search.set("q", merged.q);
    if (merged.role) search.set("role", merged.role);
    if (merged.page > 1) search.set("page", String(merged.page));
    router.replace(`${pathname}${search.size ? `?${search}` : ""}`, { scroll: false });
  };

  const users = useQuery({
    queryKey: ["admin", "users", { q, role, page }],
    queryFn: () => adminApi.users({ q: q || undefined, role, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const pageCount = users.data ? Math.ceil(users.data.total / PAGE_SIZE) : 0;

  return (
    <div className="grid gap-6">
      <Card>
        <form
          role="search"
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            go({ q: text.trim() });
          }}
        >
          <FormField label="Name, email or username">
            <Input type="search" value={text} onChange={(event) => setText(event.target.value)} />
          </FormField>
          <FormField label="Role">
            <Select value={role ?? ""} onChange={(event) => go({ role: event.target.value || undefined })}>
              <option value="">All roles</option>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {roleLabels[value]}
                </option>
              ))}
            </Select>
          </FormField>
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>
      </Card>

      <section aria-label="Results" className={cn("transition-opacity", users.isPlaceholderData && "opacity-60")}>
        {users.isPending ? (
          <div className="grid gap-2" role="status" aria-label="Loading users">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : users.isError ? (
          <EmptyState
            illustration="error"
            role="alert"
            title="Users didn't load"
            description={users.error.message}
            action={<Button onClick={() => users.refetch()}>Try again</Button>}
          />
        ) : users.data.items.length === 0 ? (
          <EmptyState illustration="search" title="No users match" description="Try part of a name or email, or another role." />
        ) : (
          <>
            <h2 className="mb-3 text-small font-bold" aria-live="polite">
              {pluralize(users.data.total, "user")}
            </h2>
            <ul className="grid gap-2">
              {users.data.items.map((user) => (
                <li key={user.id}>
                  <Card asChild interactive variant="flat" className="flex-row flex-wrap items-center justify-between gap-3 py-3">
                    <Link href={`/admin/users/${user.id}`}>
                      <span className="grid min-w-0">
                        <span className="truncate font-bold">{user.display_name}</span>
                        <span className="truncate text-small text-fg-muted">{user.email ?? (user.username ? `@${user.username}` : "No email")}</span>
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <Badge tone={roleTones[user.role]}>{roleLabels[user.role]}</Badge>
                        {!user.is_active && <Badge tone="danger">Turned off</Badge>}
                        {user.role === "teacher" && !user.teacher_verified && <Badge tone="warning">Not verified</Badge>}
                      </span>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination className="mt-6" page={page} pageCount={pageCount} onChange={(next) => go({ page: next })} />
          </>
        )}
      </section>
    </div>
  );
}
