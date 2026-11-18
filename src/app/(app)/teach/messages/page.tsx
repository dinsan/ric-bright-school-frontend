import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Inbox } from "@/features/messages/components/inbox";

export const metadata: Metadata = { title: "Messages" };

/** A teacher's conversations with their pupils' families (FE-PAR-04). */
export default function TeacherMessagesPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader title="Messages" description="Talk with your pupils' parents about how they are doing. New messages appear straight away." />
      <Inbox role="teacher" basePath="/teach/messages" />
    </div>
  );
}
