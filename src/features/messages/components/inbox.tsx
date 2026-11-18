"use client";

import { MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import type { ConversationSummary } from "../contract";
import { formatWhen } from "../format";
import { useContacts, useConversations, useOpenConversation } from "../hooks";

export type MessagingRole = "parent" | "teacher";

/**
 * The list of conversations (FE-PAR-04), latest first, with unread counts, and "New message". Shared by
 * parents (/family/messages) and teachers (/teach/messages).
 */
export function Inbox({ role, basePath }: { role: MessagingRole; basePath: string }) {
  const conversations = useConversations();
  const [composing, setComposing] = useState(false);

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="primary" onClick={() => setComposing(true)}>
          <MessageSquarePlus aria-hidden />
          New message
        </Button>
      </div>
      {conversations.isPending ? (
        <div className="grid gap-3" role="status" aria-label="Loading your messages">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : conversations.isError ? (
        <EmptyState
          illustration="error"
          role="alert"
          title="Your messages didn't load"
          description={conversations.error.message}
          action={<Button onClick={() => conversations.refetch()}>Try again</Button>}
        />
      ) : conversations.data.length === 0 ? (
        <EmptyState
          illustration="empty"
          title="No messages yet"
          description={
            role === "parent"
              ? "Write to your child's teacher about how they are doing. Press New message to start."
              : "Write to a pupil's parents about how they are doing. Press New message to start."
          }
        />
      ) : (
        <ul className="grid gap-2">
          {conversations.data.map((conversation) => (
            <li key={conversation.id}>
              <ConversationRow conversation={conversation} role={role} href={`${basePath}/${conversation.id}`} />
            </li>
          ))}
        </ul>
      )}
      <Dialog open={composing} onOpenChange={setComposing}>
        {composing && <NewConversation role={role} basePath={basePath} />}
      </Dialog>
    </div>
  );
}

/** "Leo · with Tom Teacher" for parents, "Leo's family · Class 5L" for teachers. */
export function conversationTitle(conversation: Pick<ConversationSummary, "child" | "teacher" | "classes">, role: MessagingRole) {
  return role === "parent" ? `${conversation.teacher.name}, about ${conversation.child.name}` : `${conversation.child.name}'s family`;
}

function ConversationRow({ conversation, role, href }: { conversation: ConversationSummary; role: MessagingRole; href: string }) {
  const last = conversation.last_message;
  const unread = conversation.unread > 0;
  return (
    <Link href={href} className="flex items-start gap-3 rounded-card border-2 border-line bg-surface px-4 py-3 hover:bg-surface-sunken">
      <Avatar name={role === "parent" ? conversation.teacher.name : conversation.child.name} decorative />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex flex-wrap items-center justify-between gap-x-3">
          <span className={unread ? "font-extrabold" : "font-bold"}>{conversationTitle(conversation, role)}</span>
          {last && <span className="text-caption text-fg-muted">{formatWhen(last.at)}</span>}
        </span>
        <span className="text-small text-fg-muted">{conversation.classes.join(", ")}</span>
        <span className={unread ? "line-clamp-2 text-small font-bold" : "line-clamp-2 text-small"}>
          {last ? `${last.mine ? "You" : (last.sender_name ?? "Someone")}: ${last.preview}` : "No messages yet"}
        </span>
      </span>
      {unread && (
        <Badge tone="accent" className="self-center">
          {conversation.unread}
          {" "}<span className="sr-only">unread</span>
        </Badge>
      )}
    </Link>
  );
}

function NewConversation({ role, basePath }: { role: MessagingRole; basePath: string }) {
  const ids = useId();
  const router = useRouter();
  const contacts = useContacts();
  const open = useOpenConversation();
  const [group, setGroup] = useState(""); // a child (parents) or a class (teachers)
  const [person, setPerson] = useState(""); // a teacher (parents) or a pupil (teachers)

  const start = () => {
    const body = role === "parent" ? { child_id: group, teacher_id: person } : { child_id: person };
    open.mutate(body, {
      onSuccess: ({ id }) => router.push(`${basePath}/${id}`),
      onError: (error) => toast({ title: "The conversation didn't open", description: error.message, tone: "danger" }),
    });
  };

  const data = contacts.data;
  const groups = role === "parent" ? (data?.children ?? []) : (data?.classes ?? []);
  const chosen = groups.find((entry) => entry.id === group);
  const people =
    role === "parent"
      ? ((chosen as NonNullable<typeof data>["children"][number] | undefined)?.teachers ?? []).map((teacher) => ({ id: teacher.id, label: `${teacher.name} (${teacher.classes.join(", ")})`, disabled: false }))
      : ((chosen as NonNullable<typeof data>["classes"][number] | undefined)?.students ?? []).map((student) => ({
          id: student.id,
          label: student.parents ? student.name : `${student.name} (no parent on Lumina yet)`,
          disabled: student.parents === 0,
        }));

  return (
    <DialogContent
      title="New message"
      description={role === "parent" ? "Choose your child, then the teacher to write to." : "Choose a class, then the pupil whose family you want to write to."}
    >
      {contacts.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : contacts.isError ? (
        <p role="alert">{contacts.error.message}</p>
      ) : groups.length === 0 ? (
        <p>{role === "parent" ? "Your children aren't in a class with a teacher on Lumina yet." : "You don't have a class yet."}</p>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-group`}>{role === "parent" ? "Child" : "Class"}</Label>
            <Select
              id={`${ids}-group`}
              placeholder={role === "parent" ? "Choose a child" : "Choose a class"}
              value={group}
              onChange={(event) => {
                setGroup(event.target.value);
                setPerson("");
              }}
            >
              {groups.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </div>
          {group && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${ids}-person`}>{role === "parent" ? "Teacher" : "Pupil"}</Label>
              {people.length === 0 ? (
                <p className="text-small text-fg-muted">{role === "parent" ? "No teacher on Lumina teaches this child yet." : "This class has no pupils yet."}</p>
              ) : (
                <Select id={`${ids}-person`} placeholder={role === "parent" ? "Choose a teacher" : "Choose a pupil"} value={person} onChange={(event) => setPerson(event.target.value)}>
                  {people.map((entry) => (
                    <option key={entry.id} value={entry.id} disabled={entry.disabled}>
                      {entry.label}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}
        </div>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button>Cancel</Button>
        </DialogClose>
        <Button variant="primary" disabled={!group || !person} loading={open.isPending} onClick={start}>
          Open conversation
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
