"use client";

import { Bookmark, BookOpen, CornerDownRight, NotebookPen, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDate, pluralize } from "@/lib/format";
import type { Notebook as NotebookData } from "../contract";
import { useDeleteBookmark, useDeleteNote, useNotebook } from "../hooks";
import { formatTime } from "./video-player";

const tabs = [
  { href: "/learn/courses", label: "My courses", icon: BookOpen },
  { href: "/learn/notes", label: "Notes and bookmarks", icon: NotebookPen },
];

/** "My courses" and "Notes and bookmarks": one sidebar item, two pages, switched here. */
export function CoursesNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="My learning">
      <ul className="flex flex-wrap gap-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const current = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-control items-center gap-2 rounded-control border-2 px-4 font-bold",
                  current ? "border-line bg-accent text-accent-fg shadow-sticker" : "border-line-subtle bg-surface hover:bg-surface-sunken",
                )}
              >
                <Icon aria-hidden className="size-icon" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type NoteEntry = NotebookData["notes"][number];

/** Notes grouped by course, then lesson, in the order the newest note sets. */
function groupNotes(notes: NoteEntry[]) {
  const courses = new Map<string, { title: string; lessons: Map<string, { title: string; href: string; notes: NoteEntry[] }> }>();
  for (const note of notes) {
    const course = courses.get(note.course.slug) ?? { title: note.course.title, lessons: new Map() };
    const lessonHref = note.href.split(/[?#]/)[0]!;
    const lesson = course.lessons.get(note.lesson.id) ?? { title: note.lesson.title, href: lessonHref, notes: [] };
    lesson.notes.push(note);
    course.lessons.set(note.lesson.id, lesson);
    courses.set(note.course.slug, course);
  }
  return [...courses.entries()];
}

/**
 * /learn/notes (FE-STU-06): every note and bookmark, newest first, searchable (the search is in the URL,
 * ?q=). Each one opens the lesson at its spot; a video bookmark starts the video at its moment.
 */
export function Notebook() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const notebook = useNotebook(q || undefined);
  const removeNote = useDeleteNote();
  const removeBookmark = useDeleteBookmark();

  const searchForm = (
    <form
      role="search"
      aria-label="Your notes and bookmarks"
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const text = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        router.replace(`${pathname}${text ? `?q=${encodeURIComponent(text)}` : ""}`, { scroll: false });
      }}
    >
      <label htmlFor="notebook-q" className="sr-only">
        Search your notes
      </label>
      {/* Uncontrolled, keyed on the URL: it follows the URL (back button, a cleared search) without syncing state. */}
      <Input key={q} id="notebook-q" name="q" type="search" defaultValue={q} placeholder="Search your notes" className="flex-1" />
      <Button type="submit">
        <Search aria-hidden />
        Search
      </Button>
    </form>
  );

  if (notebook.isPending) {
    return (
      <div className="grid gap-4">
        {searchForm}
        <div role="status" aria-label="Loading your notes" className="grid gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }
  if (notebook.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="Your notes didn't load"
        description={notebook.error.message}
        action={<Button onClick={() => notebook.refetch()}>Try again</Button>}
      />
    );
  }
  const { notes, bookmarks } = notebook.data;
  if (!q && notes.length === 0 && bookmarks.length === 0) {
    return (
      <EmptyState
        illustration="empty"
        title="No notes or bookmarks yet"
        description="In any lesson, press the notebook button at the top to write a note, or the bookmark button to keep the lesson. Under a video you can bookmark a moment. They all appear here."
        action={<ButtonLink href="/learn/courses">Go to my courses</ButtonLink>}
      />
    );
  }

  return (
    <div className="grid gap-8">
      {searchForm}
      {q && (
        <p role="status" className="text-small font-bold text-fg-muted">
          {notes.length + bookmarks.length === 0 ? `Nothing matches “${q}”.` : `${pluralize(notes.length, "note")} and ${pluralize(bookmarks.length, "bookmark")} match “${q}”.`}
        </p>
      )}

      {bookmarks.length > 0 && (
        <section aria-labelledby="bookmarks-heading" className="grid gap-3">
          <h2 id="bookmarks-heading" className="flex items-center gap-2 text-heading">
            <Bookmark aria-hidden className="size-6" />
            Bookmarks <span className="text-lead text-fg-muted">({bookmarks.length})</span>
          </h2>
          <ul className="grid gap-2">
            {bookmarks.map((bookmark) => {
              const what = bookmark.block_label ? `${bookmark.block_label}${bookmark.media_seconds !== null ? ` at ${formatTime(bookmark.media_seconds)}` : ""}` : "The whole lesson";
              return (
                <li key={bookmark.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-line bg-surface px-4 py-3">
                  <span className="grid min-w-0">
                    <Link href={bookmark.href} className="font-bold underline-offset-4 hover:underline">
                      {bookmark.lesson.title}
                    </Link>
                    <span className="text-small text-fg-muted">
                      {bookmark.course.title} · {what}
                      {bookmark.label ? ` · ${bookmark.label}` : ""}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <ButtonLink href={bookmark.href} size="sm" variant="secondary">
                      Open
                    </ButtonLink>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove bookmark: ${bookmark.lesson.title}, ${what}`}
                      onClick={() => removeBookmark.mutate(bookmark.id, { onError: (error) => toast({ title: "The bookmark wasn't removed", description: error.message, tone: "danger" }) })}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section aria-labelledby="notes-heading" className="grid gap-4">
          <h2 id="notes-heading" className="flex items-center gap-2 text-heading">
            <NotebookPen aria-hidden className="size-6" />
            Notes <span className="text-lead text-fg-muted">({notes.length})</span>
          </h2>
          {groupNotes(notes).map(([courseSlug, course]) => (
            <div key={courseSlug} className="grid gap-3">
              <h3 className="text-lead font-extrabold">{course.title}</h3>
              {[...course.lessons.entries()].map(([lessonId, lesson]) => (
                <div key={lessonId} className="grid gap-2 rounded-card border-2 border-line bg-surface p-4">
                  <Link href={lesson.href} className="w-fit font-bold underline underline-offset-4 hover:no-underline">
                    {lesson.title}
                  </Link>
                  <ul className="grid gap-2">
                    {lesson.notes.map((note) => (
                      <li key={note.id} className="grid gap-1 border-l-4 border-accent pl-3">
                        {note.block_label && (
                          <Link href={note.href} className="flex w-fit items-center gap-1 text-caption font-bold text-fg-muted underline underline-offset-4 hover:text-fg">
                            <CornerDownRight aria-hidden className="size-3.5" />
                            {note.block_label}
                          </Link>
                        )}
                        <p className="whitespace-pre-wrap wrap-break-word">{note.body}</p>
                        <span className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
                          {formatDate(note.updated_at)}
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete note from ${lesson.title}`}
                            onClick={() => removeNote.mutate(note.id, { onError: (error) => toast({ title: "The note wasn't deleted", description: error.message, tone: "danger" }) })}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
