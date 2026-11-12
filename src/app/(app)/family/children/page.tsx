import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ChildrenManager } from "@/features/family/components/children-manager";

export const metadata: Metadata = { title: "My children" };

export default function ChildrenPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="My children" description="Add your children, link accounts they already have, and choose how they sign in." />
      <ChildrenManager />
    </div>
  );
}
