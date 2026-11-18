import type { Metadata } from "next";
import { ConversationView } from "@/features/messages/components/conversation";

export const metadata: Metadata = { title: "Conversation" };

/** One conversation with a teacher about a child. Access is checked by the API (404 otherwise). */
export default async function ParentConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl">
      <ConversationView key={id} id={id} role="parent" backHref="/family/messages" />
    </div>
  );
}
