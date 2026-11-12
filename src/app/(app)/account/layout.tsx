import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AccountNav } from "@/features/account/components/account-nav";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Your account" />
      <AccountNav />
      <div className="grid gap-6">{children}</div>
    </div>
  );
}
