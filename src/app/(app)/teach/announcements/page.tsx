import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TeacherAnnouncements } from "@/features/messages/components/announcements";

export const metadata: Metadata = { title: "Announcements" };

/** A teacher writes to the parents of a whole class, and sees who has read it (FE-PAR-04). */
export default function TeacherAnnouncementsPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader title="Announcements" description="Write to the parents of a whole class: trips, reminders, news. They see it straight away." />
      <TeacherAnnouncements />
    </div>
  );
}
