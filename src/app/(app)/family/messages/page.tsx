import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Inbox } from "@/features/messages/components/inbox";
import { MessagesTabs } from "@/features/messages/components/messages-tabs";

export const metadata: Metadata = { title: "Messages" };

/** A parent's conversations with their children's teachers (FE-PAR-04). */
export default function ParentMessagesPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader title="Messages" description="Talk with your children's teachers about how they are doing. New messages appear straight away." />
      <MessagesTabs />
      <Inbox role="parent" basePath="/family/messages" />
    </div>
  );
}
