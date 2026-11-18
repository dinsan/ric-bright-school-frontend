"use client";

import { ArrowLeft, ChartLine, Radio, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { messagesApi } from "../api";
import { MESSAGE_MAX_LENGTH, type ConversationView as View, type Message } from "../contract";
import { dayHeading, formatWhen } from "../format";
import { useConversation, useMarkRead, useSendMessage, useShareProgress } from "../hooks";
import { useLive } from "../live";
import { conversationTitle, type MessagingRole } from "./inbox";

/**
 * One conversation about a child (FE-PAR-04): the messages (new ones appear live and are announced to
 * screen readers), a box to write, "Share a progress update", and beside it the child's work set by this
 * teacher, so both sides talk about the same thing. Opening it marks it read.
 */
export function ConversationView({ id, role, backHref }: { id: string; role: MessagingRole; backHref: string }) {
  const conversation = useConversation(id);
  const markRead = useMarkRead(id);
  const live = useLive();
  const [older, setOlder] = useState<Message[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean | null>(null);
  const data = conversation.data;

  // Read while it is on screen: on opening, and when new messages arrive while the page is visible.
  const unread = data?.unread ?? 0;
  const { mutate: markAsRead } = markRead;
  useEffect(() => {
    if (unread > 0 && document.visibilityState === "visible") markAsRead();
  }, [unread, markAsRead]);
  useEffect(() => {
    const seen = () => document.visibilityState === "visible" && unread > 0 && markAsRead();
    document.addEventListener("visibilitychange", seen);
    return () => document.removeEventListener("visibilitychange", seen);
  }, [unread, markAsRead]);

  if (conversation.isPending) {
    return (
      <div className="grid gap-4" role="status" aria-label="Loading the conversation">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (conversation.isError) {
    const gone = conversation.error instanceof ApiError && conversation.error.status === 404;
    return (
      <EmptyState
        illustration={gone ? "empty" : "error"}
        role="alert"
        title={gone ? "This conversation isn't available" : "The conversation didn't load"}
        description={gone ? "It may be about a child who is no longer in this teacher's class." : conversation.error.message}
        action={gone ? <ButtonLink href={backHref}>Back to messages</ButtonLink> : <Button onClick={() => conversation.refetch()}>Try again</Button>}
      />
    );
  }

  const view = data!;
  const messages = [...older, ...view.messages];
  const moreToLoad = hasMoreOlder ?? view.has_more;
  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const page = await messagesApi.conversation(id, messages[0]!.created_at);
      setOlder((current) => [...page.messages, ...current]);
      setHasMoreOlder(page.has_more);
    } catch (error) {
      toast({ title: "Earlier messages didn't load", description: error instanceof Error ? error.message : undefined, tone: "danger" });
    } finally {
      setLoadingOlder(false);
    }
  };
  const first = view.child.name.split(" ")[0]!;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex items-center gap-1.5 font-bold underline underline-offset-4 hover:no-underline">
          <ArrowLeft aria-hidden className="size-4" />
          All messages
        </Link>
        <p className="flex items-center gap-1.5 text-caption font-bold text-fg-muted">
          <Radio aria-hidden className={cn("size-4", live && "text-success")} />
          {live ? "Live: new messages appear straight away" : "Checking for new messages every 20 seconds"}
        </p>
      </div>
      <div className="grid gap-1">
        <h1 className="text-title">{conversationTitle(view, role)}</h1>
        <p className="text-small text-fg-muted">
          About {view.child.name}
          {view.child.grade_level ? ` (Grade ${view.child.grade_level})` : ""} · {view.classes.join(", ")} · With{" "}
          {view.participants.map((person) => `${person.name} (${person.role_label})`).join(", ")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <section aria-labelledby="thread-heading" className="grid gap-3">
          <h2 id="thread-heading" className="sr-only">
            Messages
          </h2>
          <Thread messages={messages} moreToLoad={moreToLoad} loadingOlder={loadingOlder} onLoadOlder={loadOlder} role={role} childName={first} />
          {view.can_send ? (
            <Composer id={id} role={role} childName={first} />
          ) : (
            <p className="rounded-card border-2 border-dashed border-line-subtle px-4 py-3 text-fg-muted">You can read this conversation, but not write in it.</p>
          )}
        </section>
        <WorkPanel view={view} role={role} childName={first} />
      </div>
    </div>
  );
}

function Thread({
  messages,
  moreToLoad,
  loadingOlder,
  onLoadOlder,
  role,
  childName,
}: {
  messages: Message[];
  moreToLoad: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  role: MessagingRole;
  childName: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const newest = messages.at(-1)?.id;
  // Keep the newest message in view when one arrives (unless the reader scrolled up to read older ones).
  const stick = useRef(true);
  useEffect(() => {
    const element = scroller.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [newest]);

  return (
    <div
      ref={scroller}
      onScroll={(event) => {
        const element = event.currentTarget;
        stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }}
      // Scrolls on its own: focusable, so keyboard users can scroll it too.
      tabIndex={0}
      role="region"
      aria-label="Conversation, newest at the bottom"
      className="grid max-h-[60dvh] min-h-48 content-start gap-3 overflow-y-auto rounded-card border-2 border-line bg-surface p-3 sm:p-4"
    >
      {moreToLoad && (
        <div className="justify-self-center">
          <Button size="sm" loading={loadingOlder} onClick={onLoadOlder}>
            Show earlier messages
          </Button>
        </div>
      )}
      {messages.length === 0 ? (
        <p className="py-6 text-center text-fg-muted">
          No messages yet. {role === "parent" ? `Say hello, or ask how ${childName} is doing.` : `Say hello, or share how ${childName} is doing.`}
        </p>
      ) : (
        // role="log" (on a wrapper: on the <ol> it would take away the list): screen readers announce messages
        // added at the end (new ones), not the whole list.
        <div role="log" aria-label="Messages" aria-live="polite">
          <ol className="grid gap-3">
            {messages.map((message, index) => {
              const heading = dayHeading(message.created_at);
              const newDay = index === 0 || dayHeading(messages[index - 1]!.created_at) !== heading;
              return (
                <li key={message.id} className="grid gap-3">
                  {newDay && <p className="justify-self-center rounded-full bg-surface-sunken px-3 py-0.5 text-caption font-bold text-fg-muted">{heading}</p>}
                  <MessageBubble message={message} />
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

const toneBadge: Record<"good" | "attention" | "neutral", BadgeTone> = { good: "success", attention: "warning", neutral: "neutral" };

function MessageBubble({ message }: { message: Message }) {
  const who = message.mine ? "You" : (message.sender?.name ?? "A former member");
  return (
    <article
      aria-label={`${who}, ${formatWhen(message.created_at)}`}
      className={cn(
        "grid max-w-[min(34rem,92%)] gap-1.5 rounded-card border-2 px-4 py-2.5",
        message.mine ? "justify-self-end border-line bg-info-soft text-info-soft-fg" : "justify-self-start border-line-subtle bg-surface-sunken",
      )}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-caption">
        <span className="font-bold">{who}</span>
        {!message.mine && message.sender && <span>{message.sender.role_label}</span>}
        <time dateTime={message.created_at} className="opacity-80">
          {formatWhen(message.created_at)}
        </time>
      </p>
      {message.snapshot && (
        <div className="grid gap-2 rounded-control border-2 border-line bg-surface p-3 text-fg">
          <p className="flex items-center gap-1.5 font-bold">
            <ChartLine aria-hidden className="size-4 shrink-0" />
            Progress update: {message.snapshot.title}
          </p>
          <ul className="grid gap-1.5">
            {message.snapshot.items.map((item, index) => (
              <li key={index} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-small">
                <span className="wrap-break-word">{item.label}</span>
                <Badge tone={toneBadge[item.tone ?? "neutral"]} className="whitespace-normal">
                  {item.value}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="text-caption text-fg-muted">As of {formatWhen(message.snapshot.as_of)}</p>
        </div>
      )}
      {message.body && <p className="whitespace-pre-wrap wrap-break-word">{message.body}</p>}
    </article>
  );
}

function Composer({ id, role, childName }: { id: string; role: MessagingRole; childName: string }) {
  const ids = useId();
  const [text, setText] = useState("");
  const [sharing, setSharing] = useState(false);
  const send = useSendMessage(id);
  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate(body, {
      onSuccess: () => setText(""),
      onError: (error) => toast({ title: "Your message wasn't sent", description: `${error.message} It's still in the box.`, tone: "danger" }),
    });
  };
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor={`${ids}-message`}>Write a message</Label>
      <Textarea
        id={`${ids}-message`}
        aria-describedby={`${ids}-hint`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            submit();
          }
        }}
        maxLength={MESSAGE_MAX_LENGTH}
        rows={3}
      />
      <p id={`${ids}-hint`} className="text-caption text-fg-muted">
        Ctrl + Enter sends. Everyone in this conversation reads it; {childName} doesn&apos;t.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" loading={send.isPending} disabled={!text.trim()}>
          <Send aria-hidden />
          Send
        </Button>
        <Button onClick={() => setSharing(true)}>
          <ChartLine aria-hidden />
          Share a progress update
        </Button>
      </div>
      <Dialog open={sharing} onOpenChange={setSharing}>
        {sharing && <ShareProgress id={id} role={role} childName={childName} onDone={() => setSharing(false)} />}
      </Dialog>
    </form>
  );
}

function ShareProgress({ id, role, childName, onDone }: { id: string; role: MessagingRole; childName: string; onDone: () => void }) {
  const ids = useId();
  const [note, setNote] = useState("");
  const share = useShareProgress(id);
  return (
    <DialogContent
      title="Share a progress update"
      description={
        role === "teacher"
          ? `A card with ${childName}'s work you set: what is done, in progress or not started, and when it's due.`
          : `A card with ${childName}'s learning at home in the last 7 days: time in lessons, days with learning, lessons finished, streak, latest quiz and courses in progress.`
      }
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-note`} optional>
          Add a note
        </Label>
        <Textarea id={`${ids}-note`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={MESSAGE_MAX_LENGTH} rows={3} />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button>Cancel</Button>
        </DialogClose>
        <Button
          variant="primary"
          loading={share.isPending}
          onClick={() =>
            share.mutate(note.trim() || undefined, {
              onSuccess: onDone,
              onError: (error) => toast({ title: "The update wasn't shared", description: error.message, tone: "danger" }),
            })
          }
        >
          Share update
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

const workStatus = { done: ["Done", "success"], in_progress: ["In progress", "info"], not_started: ["Not started", "neutral"] } as const;

/** The child's work set by this teacher: what both sides see while they talk. */
function WorkPanel({ view, role, childName }: { view: View; role: MessagingRole; childName: string }) {
  return (
    <aside aria-labelledby="work-heading" className="grid gap-3 rounded-card border-2 border-line bg-surface p-4">
      <h2 id="work-heading" className="text-lead font-extrabold">
        {childName}&apos;s work with {view.teacher.name}
      </h2>
      {view.context.work.length === 0 ? (
        <p className="text-small text-fg-muted">No work set yet.</p>
      ) : (
        <ul className="grid gap-2">
          {view.context.work.map((row, index) => {
            const [label, tone] = workStatus[row.status];
            return (
              <li key={index} className="grid gap-1 border-b-2 border-line-subtle pb-2 last:border-b-0 last:pb-0">
                <span className="text-small font-bold wrap-break-word">{row.title}</span>
                <span className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
                  <Badge tone={tone}>{label}</Badge>
                  {row.lessons_total > 1 && `${row.lessons_done} of ${row.lessons_total} lessons · `}
                  due {formatWhen(row.due_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {role === "parent" && (
        <Link href={`/family/children/${view.child.id}`} className="text-small font-bold underline underline-offset-4 hover:no-underline">
          See all of {childName}&apos;s progress
        </Link>
      )}
    </aside>
  );
}
