"use client";

import { CornerDownRight, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { blockLabel, type LessonBlock } from "../blocks";
import { NOTE_MAX_LENGTH, type LessonBookmark, type LessonNote } from "../contract";
import { useAddNote, useAnnotations, useDeleteBookmark, useDeleteNote, useEditNote } from "../hooks";
import { formatTime } from "./video-player";

/**
 * Notes and bookmarks inside a lesson (FE-STU-06), in the lesson player's side panel. Notes are the
 * student's own words, about the whole lesson or one part of it; bookmarks mark the lesson, a part, or a
 * moment in a video. "Go there" jumps to the part (and the moment). Private: teachers and classmates never see them.
 */

/** Scrolls to a block of the lesson and puts focus on it (for keyboard and screen-reader users too). */
export function goToBlock(blockId: string) {
  const element = document.getElementById(`block-${blockId}`);
  if (!element) return;
  element.scrollIntoView({ block: "start" });
  if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
  element.focus({ preventScroll: true });
}

function labelFor(blocks: LessonBlock[], blockId: string | null): string | null {
  if (!blockId) return null;
  const block = blocks.find((entry) => entry.id === blockId);
  return block ? blockLabel(block) : null;
}

function NoteEditor({ lessonId, blocks, defaultBlockId }: { lessonId: string; blocks: LessonBlock[]; defaultBlockId?: string | null }) {
  const add = useAddNote(lessonId);
  const [body, setBody] = useState("");
  const [about, setAbout] = useState(defaultBlockId ?? "");
  const [error, setError] = useState<string | null>(null);
  const left = NOTE_MAX_LENGTH - body.length;
  const save = () => {
    if (!body.trim()) {
      setError("Write something first.");
      return;
    }
    add.mutate(
      { body, block_id: about || null },
      {
        onSuccess: (note) => {
          setBody("");
          setAbout(defaultBlockId ?? "");
          setError(null);
          toast({ title: "Note saved", tone: "success" });
          for (const badge of note.new_badges) toast({ title: `New badge: ${badge.name}`, description: badge.description, tone: "success" });
        },
        // The text stays in the box, so nothing typed is lost.
        onError: (mutationError) => setError(`Your note wasn't saved: ${mutationError.message}`),
      },
    );
  };
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <FormField label="New note" error={error ?? undefined} hint={left < 200 ? `${left} characters left` : "Ctrl+Enter saves."}>
        <Textarea
          value={body}
          maxLength={NOTE_MAX_LENGTH}
          rows={4}
          placeholder="What do you want to remember?"
          onChange={(event) => {
            setBody(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              save();
            }
          }}
        />
      </FormField>
      <FormField label="About">
        <Select value={about} onChange={(event) => setAbout(event.target.value)}>
          <option value="">The whole lesson</option>
          {blocks.map((block) => (
            <option key={block.id} value={block.id}>
              {blockLabel(block)}
            </option>
          ))}
        </Select>
      </FormField>
      <Button type="submit" variant="primary" loading={add.isPending} className="justify-self-start">
        <Pencil aria-hidden />
        Save note
      </Button>
    </form>
  );
}

function NoteItem({ note, lessonId, label, onGoTo }: { note: LessonNote; lessonId: string; label: string | null; onGoTo: (blockId: string) => void }) {
  const edit = useEditNote(lessonId);
  const remove = useDeleteNote(lessonId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="grid gap-2 rounded-card border-2 border-line-subtle bg-surface p-3">
      {label && note.block_id && (
        <button type="button" onClick={() => onGoTo(note.block_id!)} className="flex w-fit items-center gap-1 text-caption font-bold text-fg-muted underline underline-offset-4 hover:text-fg">
          <CornerDownRight aria-hidden className="size-3.5" />
          {label} <span className="sr-only">(go there)</span>
        </button>
      )}
      {editing ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            edit.mutate(
              { noteId: note.id, body: draft },
              {
                onSuccess: () => setEditing(false),
                onError: (error) => toast({ title: "The change wasn't saved", description: error.message, tone: "danger" }),
              },
            );
          }}
        >
          <label htmlFor={`edit-${note.id}`} className="sr-only">
            Edit note
          </label>
          <Textarea id={`edit-${note.id}`} value={draft} maxLength={NOTE_MAX_LENGTH} rows={3} onChange={(event) => setDraft(event.target.value)} autoFocus />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="primary" loading={edit.isPending} disabled={!draft.trim()}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setDraft(note.body);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap wrap-break-word">{note.body}</p>
      )}
      {!editing && (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-caption text-fg-muted">
          <span>{formatDate(note.updated_at)}</span>
          <span className="flex flex-wrap items-center gap-1">
          {confirming ? (
            <>
              <span className="font-bold text-fg">Delete this note?</span>
              <Button
                size="sm"
                variant="danger"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate(note.id, { onError: (error) => toast({ title: "The note wasn't deleted", description: error.message, tone: "danger" }) })
                }
              >
                Delete
              </Button>
              <Button size="sm" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden />
                Delete
              </Button>
            </>
          )}
          </span>
        </div>
      )}
    </li>
  );
}

function bookmarkText(bookmark: LessonBookmark, blocks: LessonBlock[]): string {
  if (!bookmark.block_id) return "The whole lesson";
  const label = labelFor(blocks, bookmark.block_id) ?? "A part of the lesson";
  return bookmark.media_seconds !== null ? `${label} at ${formatTime(bookmark.media_seconds)}` : label;
}

export function NotesPanel({
  lessonId,
  blocks,
  onGoTo,
  defaultTab = "notes",
}: {
  lessonId: string;
  blocks: LessonBlock[];
  /** Jump to a block (and a moment in a video); the panel closes itself. */
  onGoTo: (blockId: string, seconds?: number | null) => void;
  defaultTab?: "notes" | "bookmarks";
}) {
  const annotations = useAnnotations(lessonId);
  const removeBookmark = useDeleteBookmark(lessonId);
  if (annotations.isPending) return <Skeleton className="h-48 w-full" />;
  if (annotations.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="Your notes didn't load"
        description={annotations.error.message}
        action={<Button onClick={() => annotations.refetch()}>Try again</Button>}
      />
    );
  }
  const { notes, bookmarks } = annotations.data;
  return (
    <Tabs defaultValue={defaultTab} className="grid gap-4">
      <TabsList aria-label="Notes and bookmarks">
        <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        <TabsTrigger value="bookmarks">Bookmarks ({bookmarks.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="notes" className="grid gap-5">
        <NoteEditor lessonId={lessonId} blocks={blocks} />
        {notes.length === 0 ? (
          <p className="text-small text-fg-muted">No notes in this lesson yet. Write down what you want to remember, in your own words.</p>
        ) : (
          <ul className="grid gap-3" aria-label="Your notes in this lesson">
            {notes.map((note) => (
              <NoteItem key={note.id} note={note} lessonId={lessonId} label={labelFor(blocks, note.block_id)} onGoTo={(blockId) => onGoTo(blockId)} />
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="bookmarks" className="grid gap-3">
        {bookmarks.length === 0 ? (
          <p className="text-small text-fg-muted">
            No bookmarks yet. Use <strong>Bookmark</strong> at the top to mark this lesson, or <strong>Bookmark this moment</strong> under a video.
          </p>
        ) : (
          <ul className="grid gap-2" aria-label="Your bookmarks in this lesson">
            {bookmarks.map((bookmark) => (
              <li key={bookmark.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border-2 border-line-subtle bg-surface p-3">
                <span className="grid min-w-0">
                  <span className="font-bold">{bookmarkText(bookmark, blocks)}</span>
                  {bookmark.label && <span className="text-small text-fg-muted">{bookmark.label}</span>}
                </span>
                <span className="flex gap-1">
                  {bookmark.block_id && (
                    <Button size="sm" onClick={() => onGoTo(bookmark.block_id!, bookmark.media_seconds)}>
                      Go there
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove bookmark: ${bookmarkText(bookmark, blocks)}`}
                    onClick={() => removeBookmark.mutate(bookmark.id, { onError: (error) => toast({ title: "The bookmark wasn't removed", description: error.message, tone: "danger" }) })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
