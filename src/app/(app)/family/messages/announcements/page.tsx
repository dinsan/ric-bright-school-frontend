import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ParentAnnouncements } from "@/features/messages/components/announcements";
import { MessagesTabs } from "@/features/messages/components/messages-tabs";

export const metadata: Metadata = { title: "Announcements" };

/** What your children's teachers announced to their classes (FE-PAR-04). */
export default function ParentAnnouncementsPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader title="Messages" description="Announcements from your children's teachers to their classes." />
      <MessagesTabs />
      <ParentAnnouncements />
    </div>
  );
}
