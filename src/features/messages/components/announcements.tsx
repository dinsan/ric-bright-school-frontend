"use client";

import { Check, Megaphone, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX, type Announcement } from "../contract";
import { formatWhen } from "../format";
import { useAnnouncements, useContacts, useDeleteAnnouncement, useMarkAnnouncementRead, usePostAnnouncement } from "../hooks";

/**
 * Class announcements (FE-PAR-04). Parents: what their children's teachers announced, new ones marked, and
 * "Mark as read". Teachers: write one to a class, and see how many parents have read each.
 */

function List({ children }: { children: ReactNode }) {
  return <ul className="grid gap-3">{children}</ul>;
}

function States({ query, empty, children }: { query: ReturnType<typeof useAnnouncements>; empty: ReactNode; children: (items: Announcement[]) => ReactNode }) {
  if (query.isPending) {
    return (
      <div className="grid gap-3" role="status" aria-label="Loading announcements">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <EmptyState illustration="error" role="alert" title="Announcements didn't load" description={query.error.message} action={<Button onClick={() => query.refetch()}>Try again</Button>} />
    );
  }
  return query.data.length === 0 ? empty : children(query.data);
}

export function ParentAnnouncements() {
  const announcements = useAnnouncements();
  const markRead = useMarkAnnouncementRead();
  return (
    <States
      query={announcements}
      empty={<EmptyState illustration="empty" title="No announcements yet" description="When your child's teacher writes to the class, it appears here." />}
    >
      {(items) => (
        <List>
          {items.map((item) => (
            <li key={item.id}>
              <Card variant={item.read ? "flat" : "sticker"} className="gap-2" aria-labelledby={`announcement-${item.id}`} role="group">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 id={`announcement-${item.id}`} className="text-lead font-extrabold wrap-break-word">
                    {item.title}
                  </h2>
                  {!item.read && <Badge tone="accent">New</Badge>}
                </div>
                <p className="text-small text-fg-muted">
                  {item.teacher_name} · {item.class_name}
                  {item.children.length > 0 && ` (${item.children.join(", ")}'s class)`} · {formatWhen(item.created_at)}
                </p>
                <p className="whitespace-pre-wrap wrap-break-word">{item.body}</p>
                {!item.read && (
                  <div>
                    <Button
                      size="sm"
                      loading={markRead.isPending && markRead.variables === item.id}
                      onClick={() => markRead.mutate(item.id, { onError: (error) => toast({ title: "Not marked as read", description: error.message, tone: "danger" }) })}
                    >
                      <Check aria-hidden />
                      Mark as read
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </List>
      )}
    </States>
  );
}

export function TeacherAnnouncements() {
  const announcements = useAnnouncements();
  const remove = useDeleteAnnouncement();
  const [removing, setRemoving] = useState<Announcement | null>(null);
  return (
    <div className="grid gap-6">
      <AnnouncementComposer />
      <section aria-labelledby="sent-heading" className="grid gap-3">
        <h2 id="sent-heading" className="text-heading">
          Sent
        </h2>
        <States query={announcements} empty={<p className="text-fg-muted">Nothing sent yet.</p>}>
          {(items) => (
            <List>
              {items.map((item) => (
                <li key={item.id}>
                  <Card variant="flat" className="gap-2" aria-labelledby={`announcement-${item.id}`} role="group">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 id={`announcement-${item.id}`} className="text-lead font-extrabold wrap-break-word">
                        {item.title}
                      </h3>
                      {item.reach && (
                        <Badge tone={item.reach.parents > 0 && item.reach.read === item.reach.parents ? "success" : "neutral"}>
                          Read by {item.reach.read} of {item.reach.parents} {item.reach.parents === 1 ? "parent" : "parents"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-small text-fg-muted">
                      {item.class_name} · {formatWhen(item.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap wrap-break-word">{item.body}</p>
                    <div>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(item)}>
                        <Trash2 aria-hidden />
                        Remove
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </List>
          )}
        </States>
      </section>
      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        {removing && (
          <DialogContent title="Remove this announcement?" description={`“${removing.title}” disappears for every parent in ${removing.class_name}.`}>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Keep it</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate(removing.id, {
                    onSuccess: () => setRemoving(null),
                    onError: (error) => toast({ title: "It wasn't removed", description: error.message, tone: "danger" }),
                  })
                }
              >
                Remove it
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function AnnouncementComposer() {
  const ids = useId();
  const contacts = useContacts();
  const post = usePostAnnouncement();
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const classes = contacts.data?.classes ?? [];
  const chosen = classes.find((entry) => entry.id === classId);
  const families = chosen ? chosen.students.filter((student) => student.parents > 0).length : 0;

  const submit = () => {
    const problems: Record<string, string> = {};
    if (!classId) problems.class_id = "Choose a class.";
    if (!title.trim()) problems.title = "Give it a title.";
    if (!body.trim()) problems.body = "Write the announcement.";
    setErrors(problems);
    if (Object.keys(problems).length) return;
    post.mutate(
      { class_id: classId, title: title.trim(), body: body.trim() },
      {
        onSuccess: (created) => {
          toast({ title: "Announcement sent", description: `${created.class_name}: ${created.reach?.parents ?? 0} parents can read it now.`, tone: "success" });
          setTitle("");
          setBody("");
        },
        onError: (error) => {
          if (error instanceof ApiError && error.details.length) {
            setErrors(Object.fromEntries(error.details.map((detail) => [String(detail.field).replace(/^body\./, ""), detail.message ?? ""])));
          } else toast({ title: "The announcement wasn't sent", description: error.message, tone: "danger" });
        },
      },
    );
  };

  const field = (name: string) => ({ "aria-invalid": errors[name] ? true : undefined, "aria-describedby": errors[name] ? `${ids}-${name}-error` : undefined });
  const error = (name: string) =>
    errors[name] && (
      <p id={`${ids}-${name}-error`} className="text-small font-bold text-danger-text">
        {errors[name]}
      </p>
    );

  return (
    <Card className="gap-4">
      <h2 className="flex items-center gap-2 text-heading">
        <Megaphone aria-hidden className="size-6" />
        New announcement
      </h2>
      {contacts.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : contacts.isError ? (
        <p role="alert">{contacts.error.message}</p>
      ) : classes.length === 0 ? (
        <p className="text-fg-muted">You don&apos;t have a class yet.</p>
      ) : (
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-class`}>Class</Label>
            <Select id={`${ids}-class`} placeholder="Choose a class" value={classId} onChange={(event) => setClassId(event.target.value)} {...field("class_id")}>
              {classes.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
            {chosen && (
              <p className="text-small text-fg-muted">
                The parents of {families} of {chosen.students.length} {chosen.students.length === 1 ? "pupil" : "pupils"} are on Lumina and will see it.
              </p>
            )}
            {error("class_id")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-title`}>Title</Label>
            <Input id={`${ids}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={ANNOUNCEMENT_TITLE_MAX} {...field("title")} />
            {error("title")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-body`}>Announcement</Label>
            <Textarea id={`${ids}-body`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={ANNOUNCEMENT_BODY_MAX} rows={5} {...field("body")} />
            {error("body")}
          </div>
          <div>
            <Button type="submit" variant="primary" loading={post.isPending}>
              <Megaphone aria-hidden />
              Send to parents
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
