import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ChildNav } from "@/features/family/components/child-nav";
import { ReportDownload } from "@/features/family/components/report-download";
import { loadChild } from "./child";

interface Props {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

/** A child's pages for their parent: the name, the report download, and the tabs (progress, controls). */
export default async function ChildLayout({ children, params }: Props) {
  // Checked here, before the page streams: someone else's child answers with a real 404.
  const { child } = await loadChild((await params).id);
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <Breadcrumb items={[{ label: "Overview", href: "/family" }, { label: child.display_name }]} />
      <PageHeader title={child.display_name} description={child.grade_level ? `Grade ${child.grade_level}` : undefined} actions={<ReportDownload childId={child.id} />} />
      <ChildNav childId={child.id} name={child.display_name} />
      {children}
    </div>
  );
}
