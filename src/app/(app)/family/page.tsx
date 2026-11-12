import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { ChildrenManager } from "@/features/family/components/children-manager";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Overview" };

export default async function ParentHome() {
  const user = await requireUser(["parent"]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Hi, ${user.display_name.split(" ")[0]}`}
        description="Your children's accounts. Progress and reports arrive here soon."
        actions={<ButtonLink href="/family/children">Manage children</ButtonLink>}
      />
      <ChildrenManager manage={false} />
    </div>
  );
}
