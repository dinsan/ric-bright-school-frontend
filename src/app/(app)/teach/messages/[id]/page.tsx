import type { Metadata } from "next";
import { ConversationView } from "@/features/messages/components/conversation";

export const metadata: Metadata = { title: "Conversation" };

/** One conversation with a pupil's family. Access is checked by the API (404 otherwise). */
export default async function TeacherConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl">
      <ConversationView key={id} id={id} role="teacher" backHref="/teach/messages" />
    </div>
  );
}
