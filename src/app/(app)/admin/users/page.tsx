import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersBrowser } from "@/features/admin/components/users-browser";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Users" />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <UsersBrowser />
      </Suspense>
    </div>
  );
}
