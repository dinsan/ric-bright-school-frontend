"use client";

import { Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, ListOrdered, NotebookPen, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SkipLink } from "@/components/layout/skip-link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { useVisibleSeconds } from "@/hooks/use-visible-seconds";
import type { LessonView } from "../contract";
import { useAddBookmark, useAnnotations, useDeleteBookmark, useEnroll, useLessonView } from "../hooks";
import { useStudent } from "../student-context";
import { SaveStatus, useProgressSync } from "../sync/progress-sync";
import { lessonDoneToast, usePlayful } from "./celebration";
import { LessonBlocks } from "./lesson-blocks";
import { LessonOutline } from "./lesson-outline";
import { goToBlock, NotesPanel } from "./notes-panel";
import { formatTime } from "./video-player";

/** Time spent is sent at least this often while the lesson is open (nothing lost if the tab crashes). */
const TIME_REPORT_MS = 60_000;

/**
 * The lesson player (FE-STU-03): a focused layout with the course outline (sidebar on large screens,
 * drawer on small ones), the lesson's content blocks, previous / next, "Done", and a quiet "saved"
 * indicator.
 *
 * Progress goes through the offline-safe queue (useProgressSync, FE-STU-05): opening the lesson marks it
 * started (so "Continue" comes back here), time on task is counted only while visible, video positions
 * are kept, and "Done" shows at once, even offline, and is sent when possible. What the queue still holds
 * is shown as if saved (the outline ticks don't wait for the network).
 */
export function LessonPlayer({ initial, exitHref, startSeconds = null }: { initial: LessonView; exitHref: string; startSeconds?: number | null }) {
  const student = useStudent();
  const router = useRouter();
  const playful = usePlayful();
  const sync = useProgressSync();
  const enroll = useEnroll();
  const lessonId = initial.lesson.id;
  const query = useLessonView(lessonId, initial);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  /** A spot to jump to: a block, and a moment when it's a video (from a bookmark, or the URL). */
  const [jump, setJump] = useState<{ blockId: string; seconds: number; key: number } | null>(null);
  const pendingGoTo = useRef<{ blockId: string; seconds?: number | null } | null>(null);
  const base = query.data ?? initial;

  // What the queue hasn't sent yet counts already: a lesson marked done offline shows as done.
  const view: LessonView = {
    ...base,
    outline: base.outline.map((lesson) => (sync.pendingFor(lesson.id)?.status === "completed" ? { ...lesson, status: "completed" } : lesson)),
    progress: sync.pendingFor(lessonId)?.status === "completed" ? { ...base.progress, status: "completed" } : base.progress,
  };
  const done = view.progress.status === "completed";

  // Notes and bookmarks (FE-STU-06): only once the course is started (the server refuses them before).
  const annotations = useAnnotations(lessonId, view.enrolled);
  const addBookmark = useAddBookmark(lessonId);
  const removeBookmark = useDeleteBookmark(lessonId);
  const lessonBookmark = annotations.data?.bookmarks.find((bookmark) => !bookmark.block_id);
  const moments: Record<string, Array<{ id: string; seconds: number; label: string | null }>> = {};
  for (const bookmark of annotations.data?.bookmarks ?? []) {
    if (bookmark.block_id && bookmark.media_seconds !== null) (moments[bookmark.block_id] ??= []).push({ id: bookmark.id, seconds: bookmark.media_seconds, label: bookmark.label });
  }
  const go = (blockId: string, seconds?: number | null) => {
    goToBlock(blockId);
    if (seconds != null) setJump({ blockId, seconds, key: Date.now() });
  };
  const toggleLessonBookmark = () => {
    if (lessonBookmark) {
      removeBookmark.mutate(lessonBookmark.id, {
        onSuccess: () => toast({ title: "Bookmark removed" }),
        onError: (error) => toast({ title: "The bookmark wasn't removed", description: error.message, tone: "danger" }),
      });
    } else {
      addBookmark.mutate(
        {},
        {
          onSuccess: () => toast({ title: "Lesson bookmarked", description: "Find it again under My courses, Notes and bookmarks.", tone: "success" }),
          onError: (error) => toast({ title: "The bookmark wasn't added", description: error.message, tone: "danger" }),
        },
      );
    }
  };
  const bookmarkMoment = (blockId: string, seconds: number) =>
    addBookmark.mutate(
      { block_id: blockId, media_seconds: seconds },
      {
        onSuccess: () => toast({ title: `Bookmarked ${formatTime(seconds)}`, description: "Press the time under the video to jump back.", tone: "success" }),
        onError: (error) => toast({ title: "The bookmark wasn't added", description: error.message, tone: "danger" }),
      },
    );

  // Opened from a bookmark or note: #block-… is the part, ?t= the moment in its video.
  useEffect(() => {
    const blockId = window.location.hash.startsWith("#block-") ? decodeURIComponent(window.location.hash.slice(7)) : null;
    if (!blockId) return;
    const timer = window.setTimeout(() => go(blockId, startSeconds), 50);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per lesson
  }, [lessonId]);
  const lessonsDone = view.outline.filter((lesson) => lesson.status === "completed").length;
  const lessonHref = (slug: string) => `/learn/courses/${view.course.slug}/lessons/${slug}`;

  // Time on task: counted while the lesson is on screen, sent with "Done", every minute, and on leaving.
  const enrolledRef = useRef(view.enrolled);
  useEffect(() => {
    enrolledRef.current = view.enrolled;
  }, [view.enrolled]);
  const { take } = useVisibleSeconds({
    onHide: (seconds) => {
      if (enrolledRef.current) sync.record(lessonId, { seconds });
    },
  });
  useEffect(() => {
    if (!view.enrolled) return;
    const timer = setInterval(() => {
      const seconds = take();
      if (seconds > 0) sync.record(lessonId, { seconds });
    }, TIME_REPORT_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync.record is stable (the queue)
  }, [view.enrolled, lessonId, take]);

  // Opening the lesson counts as starting it (once per visit).
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (!view.enrolled || started.current === lessonId) return;
    started.current = lessonId;
    sync.record(lessonId, { status: "started" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync.record is stable (the queue)
  }, [view.enrolled, lessonId]);

  const markDone = () => {
    sync.record(lessonId, { status: "completed", seconds: take() });
    // Offline, the next lesson can't load (it comes from the server; offline lessons are FE-PWA-02).
    // Stay here, with the work safe on the device, rather than landing on the browser's error page.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast({ title: "Saved on this device", description: "You're offline. Your progress is sent as soon as you're back, and the next lesson opens then." });
      return;
    }
    lessonDoneToast(view.lesson.title, playful);
    if (view.next) router.push(lessonHref(view.next.slug));
  };

  const previousLink = view.previous && (
    <ButtonLink href={lessonHref(view.previous.slug)} variant="ghost" aria-label={`Previous lesson: ${view.previous.title}`}>
      <ChevronLeft aria-hidden />
      <span className="max-sm:sr-only">Previous</span>
    </ButtonLink>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SkipLink />
      <header className="sticky top-0 z-sticky border-b-2 border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-gutter py-2.5">
          <ButtonLink href={exitHref} variant="ghost" size="icon" aria-label="Save and exit" className="-ml-2">
            <X aria-hidden />
          </ButtonLink>
          <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Lessons in this course" className="lg:hidden">
                <ListOrdered aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" title="Lessons in this course" hideTitle>
              <LessonOutline view={view} onNavigate={() => setOutlineOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption font-bold text-fg-muted">{view.course.title}</p>
            <p className="truncate font-bold">{view.lesson.title}</p>
          </div>
          {view.enrolled && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={Boolean(lessonBookmark)}
                aria-label={lessonBookmark ? "Bookmarked: remove the bookmark" : "Bookmark this lesson"}
                onClick={toggleLessonBookmark}
                disabled={annotations.isPending}
              >
                {lessonBookmark ? <BookmarkCheck aria-hidden className="fill-accent" /> : <Bookmark aria-hidden />}
              </Button>
              <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
                <SheetTrigger asChild>
                  {/* The name is built from content (hidden words + the visible count), so what is seen is what is heard (WCAG 2.5.3). */}
                  <Button variant="ghost" size="icon" className="relative">
                    <NotebookPen aria-hidden />
                    <span className="sr-only">Notes and bookmarks:</span>{" "}
                    {(annotations.data?.notes.length ?? 0) > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full border-2 border-line bg-accent px-1 text-center text-[0.7rem] font-black leading-4 text-accent-fg">
                        {annotations.data!.notes.length} <span className="sr-only">notes</span>
                      </span>
                    ) : (
                      <span className="sr-only">no notes yet</span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  title="Notes and bookmarks"
                  description="Private: your teachers and classmates can't see them."
                  onCloseAutoFocus={(event) => {
                    // Going to a part of the lesson: focus goes there, not back to the Notes button.
                    const target = pendingGoTo.current;
                    if (!target) return;
                    event.preventDefault();
                    pendingGoTo.current = null;
                    go(target.blockId, target.seconds);
                  }}
                >
                  <NotesPanel
                    lessonId={lessonId}
                    blocks={view.blocks}
                    onGoTo={(blockId, seconds) => {
                      pendingGoTo.current = { blockId, seconds };
                      setNotesOpen(false);
                    }}
                  />
                </SheetContent>
              </Sheet>
            </>
          )}
          <SaveStatus className="max-sm:[&>span]:sr-only" />
          <p className="shrink-0 text-small font-bold tabular-nums text-fg-muted">
            <span className="sr-only">Lesson</span> {view.lesson.position} of {view.outline.length}
          </p>
        </div>
        <div className="mx-auto max-w-7xl px-gutter pb-2.5">
          <Progress value={lessonsDone} max={Math.max(1, view.outline.length)} label="Course progress" valueText={`${lessonsDone} of ${view.outline.length} lessons done`} tone="success" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-gutter">
        <aside className="sticky top-28 hidden max-h-[calc(100dvh-8rem)] w-72 shrink-0 self-start overflow-y-auto py-8 lg:block">
          <LessonOutline view={view} />
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-8 outline-none sm:py-12">
          <article className="mx-auto grid max-w-3xl gap-8">
            <header className="grid gap-2">
              <p className="text-small font-bold text-fg-muted">
                Lesson {view.lesson.position} of {view.outline.length}
                {view.lesson.duration_minutes ? ` · about ${view.lesson.duration_minutes} min` : ""}
              </p>
              <h1 className="text-title">{view.lesson.title}</h1>
              <p className="text-lead text-fg-muted">{view.lesson.summary}</p>
              <p role="status" className="min-h-7">
                {done && (
                  <Badge tone="success">
                    <Check aria-hidden className="size-4" /> Done
                  </Badge>
                )}
              </p>
            </header>

            {!view.enrolled && view.locked_reason ? (
              <Alert tone="info" title="This course isn't open yet" action={<ButtonLink href="/learn/path" variant="secondary">See your learning path</ButtonLink>}>
                {view.locked_reason}
              </Alert>
            ) : !view.enrolled ? (
              <Alert
                tone="info"
                title={`Start ${view.course.title}, ${student.firstName}?`}
                action={
                  <Button
                    variant="primary"
                    loading={enroll.isPending}
                    onClick={() =>
                      enroll.mutate(view.course.id, {
                        onError: (error) => toast({ title: "The course didn't start", description: error.message, tone: "danger" }),
                      })
                    }
                  >
                    Start this course
                  </Button>
                }
              >
                Starting the course opens its lessons and saves your progress, so you can always carry on where you stopped.
              </Alert>
            ) : view.blocks.length === 0 ? (
              <EmptyState illustration="empty" title="This lesson is being written" description="Its activities aren't ready yet. Read the summary above, then press Done." />
            ) : (
              <LessonBlocks
                blocks={view.blocks}
                mediaPositions={view.progress.media_positions}
                onMediaPosition={(blockId, seconds) => sync.record(lessonId, { media: { [blockId]: seconds } })}
                onBookmarkMoment={bookmarkMoment}
                moments={moments}
                jump={jump}
              />
            )}
          </article>
        </main>
      </div>

      <footer className="sticky bottom-0 z-sticky border-t-2 border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-gutter py-3">
          {previousLink ?? <span />}
          {view.enrolled &&
            (!done ? (
              <Button variant="primary" onClick={markDone}>
                <Check aria-hidden />
                {view.next ? "Done, next lesson" : "Done"}
              </Button>
            ) : view.next ? (
              <ButtonLink href={lessonHref(view.next.slug)} variant="primary">
                Next lesson
                <ChevronRight aria-hidden />
              </ButtonLink>
            ) : (
              <ButtonLink href={exitHref} variant="primary">
                Back to the course
              </ButtonLink>
            ))}
        </div>
      </footer>
    </div>
  );
}
