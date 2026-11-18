import "server-only";

import { z } from "zod";
import type { Auth } from "@/server/auth/context";
import { escapeLike, getDb } from "@/server/db";
import { fieldError, HttpError, notFound } from "@/server/http/errors";
import { blockLabel, lessonSpotHref, parseBlocks, type LessonBlock } from "@/features/learn/blocks";
import { NOTE_MAX_LENGTH, type AnnotationContext, type LessonAnnotations, type LessonBookmark, type LessonNote, type Notebook, type NoteResult } from "@/features/learn/contract";
import { awardBadges, learningStats } from "./service";

/**
 * Notes and bookmarks inside lessons (FE-STU-06, BE-LRN-04). Private to the student: only they can read,
 * change or delete them (another student's note is "not found"); teachers and other students never see
 * them. A parent's copy of their child's data (FE-PUB-11) includes them, as it includes everything stored
 * about the child. Note text is never logged. Writing needs the course started (like progress).
 */

const MAX_NOTES_PER_LESSON = 100;
const MAX_BOOKMARKS_PER_LESSON = 50;
const BLOCK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

const noteBody = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(NOTE_MAX_LENGTH, `A note can be up to ${NOTE_MAX_LENGTH} characters. Split it into two notes.`);

export const noteCreateInput = z.object({ body: noteBody, block_id: z.string().regex(BLOCK_ID).nullish() });
export const noteUpdateInput = z.object({ body: noteBody });
export const bookmarkCreateInput = z.object({
  block_id: z.string().regex(BLOCK_ID).nullish(),
  media_seconds: z.number().min(0).max(6 * 60 * 60).nullish(),
  label: z.string().trim().max(120).nullish(),
});
export const notebookInput = z.object({ q: z.string().trim().max(100).optional() });

function toNote(row: { id: string; lessonId: string; blockId: string | null; body: string; createdAt: Date; updatedAt: Date }): LessonNote {
  return { id: row.id, lesson_id: row.lessonId, block_id: row.blockId, body: row.body, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() };
}

function toBookmark(row: { id: string; lessonId: string; blockId: string | null; mediaSeconds: number | null; label: string | null; createdAt: Date }): LessonBookmark {
  return { id: row.id, lesson_id: row.lessonId, block_id: row.blockId, media_seconds: row.mediaSeconds, label: row.label, created_at: row.createdAt.toISOString() };
}

/** The lesson, its blocks, and whether the student may read / write annotations on it. */
async function lessonFor(auth: Auth, lessonId: string, { write }: { write: boolean }) {
  const db = getDb();
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true, content: true, course: { select: { status: true } } } });
  if (!lesson) throw notFound("That lesson");
  const enrolled = await db.enrollment.findUnique({ where: { studentId_courseId: { studentId: auth.user.id, courseId: lesson.courseId } }, select: { id: true } });
  if (!enrolled && lesson.course.status !== "published") throw notFound("That lesson");
  if (write && !enrolled) throw new HttpError(409, "not_enrolled", "Start the course first, then write notes and add bookmarks in its lessons.");
  return { ...lesson, blocks: parseBlocks(lesson.content).blocks };
}

function findBlock(blocks: LessonBlock[], blockId: string | null | undefined, field = "block_id"): LessonBlock | null {
  if (!blockId) return null;
  const block = blocks.find((entry) => entry.id === blockId);
  if (!block) throw fieldError(field, "That part of the lesson doesn't exist any more.");
  return block;
}

function assertStudent(auth: Auth) {
  if (auth.user.role !== "student") throw new HttpError(403, "forbidden", "Only students keep notes in lessons.");
}

/** The student's notes and bookmarks in one lesson (for the lesson player). */
export async function lessonAnnotations(auth: Auth, lessonId: string): Promise<LessonAnnotations> {
  assertStudent(auth);
  await lessonFor(auth, lessonId, { write: false });
  const db = getDb();
  const [notes, bookmarks] = await Promise.all([
    db.lessonNote.findMany({ where: { studentId: auth.user.id, lessonId }, orderBy: { createdAt: "asc" } }),
    db.lessonBookmark.findMany({ where: { studentId: auth.user.id, lessonId }, orderBy: [{ createdAt: "asc" }] }),
  ]);
  return { notes: notes.map(toNote), bookmarks: bookmarks.map(toBookmark) };
}

/** Writes a note (about the lesson, or one block). Writing notes counts towards the "Note taker" badge. */
export async function createNote(auth: Auth, lessonId: string, input: z.output<typeof noteCreateInput>, now = new Date()): Promise<NoteResult> {
  assertStudent(auth);
  const lesson = await lessonFor(auth, lessonId, { write: true });
  findBlock(lesson.blocks, input.block_id);
  const db = getDb();
  if ((await db.lessonNote.count({ where: { studentId: auth.user.id, lessonId } })) >= MAX_NOTES_PER_LESSON) {
    throw new HttpError(409, "too_many_notes", `A lesson can have up to ${MAX_NOTES_PER_LESSON} notes. Join some of them together, or delete old ones.`);
  }
  const note = await db.lessonNote.create({ data: { studentId: auth.user.id, lessonId, blockId: input.block_id ?? null, body: input.body, createdAt: now, updatedAt: now } });
  const { stats } = await learningStats(db, auth.user.id, auth.user.timezone, now);
  const newBadges = await awardBadges(db, auth.user.id, stats, now);
  return { ...toNote(note), new_badges: newBadges };
}

export async function updateNote(auth: Auth, noteId: string, { body }: z.output<typeof noteUpdateInput>): Promise<LessonNote> {
  assertStudent(auth);
  const db = getDb();
  const updated = await db.lessonNote.updateMany({ where: { id: noteId, studentId: auth.user.id }, data: { body, updatedAt: new Date() } });
  if (updated.count === 0) throw notFound("That note");
  return toNote(await db.lessonNote.findUniqueOrThrow({ where: { id: noteId } }));
}

export async function deleteNote(auth: Auth, noteId: string): Promise<void> {
  assertStudent(auth);
  const deleted = await getDb().lessonNote.deleteMany({ where: { id: noteId, studentId: auth.user.id } });
  if (deleted.count === 0) throw notFound("That note");
}

/**
 * Adds a bookmark: the lesson, one part of it, or a moment in a video. Adding the same one twice is fine:
 * the existing bookmark comes back (`created: false`).
 */
export async function createBookmark(auth: Auth, lessonId: string, input: z.output<typeof bookmarkCreateInput>): Promise<{ bookmark: LessonBookmark; created: boolean }> {
  assertStudent(auth);
  const lesson = await lessonFor(auth, lessonId, { write: true });
  const block = findBlock(lesson.blocks, input.block_id);
  const seconds = input.media_seconds == null ? null : Math.floor(input.media_seconds);
  if (seconds !== null && block?.type !== "video") throw fieldError("media_seconds", "A moment can only be bookmarked in a video.");
  const anchor = !block ? "lesson" : seconds !== null ? `video:${block.id}@${seconds}` : `block:${block.id}`;
  const db = getDb();
  const existing = await db.lessonBookmark.findUnique({ where: { studentId_lessonId_anchor: { studentId: auth.user.id, lessonId, anchor } } });
  if (existing) return { bookmark: toBookmark(existing), created: false };
  if ((await db.lessonBookmark.count({ where: { studentId: auth.user.id, lessonId } })) >= MAX_BOOKMARKS_PER_LESSON) {
    throw new HttpError(409, "too_many_bookmarks", `A lesson can have up to ${MAX_BOOKMARKS_PER_LESSON} bookmarks. Delete some you don't need any more.`);
  }
  // INSERT … ON CONFLICT DO NOTHING: a double click never makes two.
  const inserted = await db.lessonBookmark.createMany({
    data: [{ studentId: auth.user.id, lessonId, anchor, blockId: block?.id ?? null, mediaSeconds: seconds, label: input.label ?? null }],
    skipDuplicates: true,
  });
  const row = await db.lessonBookmark.findUniqueOrThrow({ where: { studentId_lessonId_anchor: { studentId: auth.user.id, lessonId, anchor } } });
  return { bookmark: toBookmark(row), created: inserted.count > 0 };
}

export async function deleteBookmark(auth: Auth, bookmarkId: string): Promise<void> {
  assertStudent(auth);
  const deleted = await getDb().lessonBookmark.deleteMany({ where: { id: bookmarkId, studentId: auth.user.id } });
  if (deleted.count === 0) throw notFound("That bookmark");
}

/** Every note and bookmark of the student, newest first, each with where it belongs. `q` searches notes' text and lesson names. */
export async function notebook(auth: Auth, { q }: z.output<typeof notebookInput>): Promise<Notebook> {
  assertStudent(auth);
  const db = getDb();
  const contains = q ? ({ contains: escapeLike(q), mode: "insensitive" } as const) : undefined;
  const lessonSelect = { select: { id: true, slug: true, title: true, content: true, course: { select: { slug: true, title: true } } } } as const;
  const [notes, bookmarks] = await Promise.all([
    db.lessonNote.findMany({
      where: { studentId: auth.user.id, ...(contains ? { OR: [{ body: contains }, { lesson: { title: contains } }, { lesson: { course: { title: contains } } }] } : {}) },
      include: { lesson: lessonSelect },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    db.lessonBookmark.findMany({
      where: { studentId: auth.user.id, ...(contains ? { OR: [{ label: contains }, { lesson: { title: contains } }, { lesson: { course: { title: contains } } }] } : {}) },
      include: { lesson: lessonSelect },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const blocksOf = new Map<string, LessonBlock[]>();
  const context = (lesson: (typeof notes)[number]["lesson"], blockId: string | null, seconds: number | null = null): AnnotationContext => {
    if (!blocksOf.has(lesson.id)) blocksOf.set(lesson.id, parseBlocks(lesson.content).blocks);
    const block = blockId ? blocksOf.get(lesson.id)!.find((entry) => entry.id === blockId) : undefined;
    return {
      course: lesson.course,
      lesson: { id: lesson.id, slug: lesson.slug, title: lesson.title },
      // A part removed from the lesson since: the note stays, about the lesson.
      block_label: block ? blockLabel(block) : null,
      href: lessonSpotHref(lesson.course.slug, lesson.slug, block?.id, seconds),
    };
  };
  return {
    notes: notes.map((row) => ({ ...toNote(row), ...context(row.lesson, row.blockId) })),
    bookmarks: bookmarks.map((row) => ({ ...toBookmark(row), ...context(row.lesson, row.blockId, row.mediaSeconds) })),
  };
}
