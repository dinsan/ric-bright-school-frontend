import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AssignmentsList } from "@/features/learn/components/assignments-list";

export const metadata: Metadata = { title: "Assignments" };

export default function AssignmentsPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="Assignments" description="Work your teachers set for your class, with when it is due." />
      <AssignmentsList />
    </div>
  );
}
