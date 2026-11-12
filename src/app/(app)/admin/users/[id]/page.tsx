import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { UserDetail } from "@/features/admin/components/user-detail";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, admin] = await Promise.all([params, requireUser(["admin"])]);
  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb className="mb-6" items={[{ label: "Users", href: "/admin/users" }, { label: "User" }]} />
      <PageHeader title="User details" />
      <UserDetail userId={id} selfId={admin.id} />
    </div>
  );
}
