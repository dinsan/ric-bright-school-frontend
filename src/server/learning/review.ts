import "server-only";

import { z } from "zod";
import type { Auth } from "@/server/auth/context";
import { getDb, type Executor } from "@/server/db";
import { fieldError, notFound } from "@/server/http/errors";
import { localDay } from "@/features/learn/analytics";
import { parseBlocks, type CheckBlock } from "@/features/learn/blocks";
import type { ReviewAnswerResult, ReviewOverview, ReviewQuestion, ReviewSession } from "@/features/learn/contract";
import { firstReviewAt, scheduleReview, strengthLabel } from "@/features/learn/spaced";

/**
 * Review queue and practice mode (FE-STU-10, BE-LRN-08). The questions are the quick checks of lessons the
 * student finished: each becomes a review item, scheduled by the Leitner boxes in spaced.ts.
 *
 * - Review: the questions due now; answers move them between boxes (the schedule).
 * - Practice: any questions (of one course, or all), weakest first; answers never change the schedule.
 * - Answers are checked here: the right answer is only sent back after the student has answered.
 */

const checksOf = (content: unknown) => parseBlocks(content).blocks.filter((block): block is CheckBlock => block.type === "check");

/**
 * Makes sure every quick check of the student's finished lessons has a review item (questions of lessons
 * finished before review existed, or added to a lesson later, join the queue). First review: the day
 * after the lesson was finished. Existing items are never changed.
 */
export async function syncReviewItems(db: Executor, studentId: string, lessonIds?: string[]): Promise<void> {
  const finished = await db.lessonProgress.findMany({
    where: { studentId, status: "completed", ...(lessonIds ? { lessonId: { in: lessonIds } } : {}) },
    select: { lessonId: true, completedAt: true, lesson: { select: { content: true } } },
  });
  const data = finished.flatMap((row) =>
    checksOf(row.lesson.content).map((block) => ({ studentId, lessonId: row.lessonId, blockId: block.id, dueAt: firstReviewAt(row.completedAt ?? new Date()) })),
  );
  if (data.length) await db.reviewItem.createMany({ data, skipDuplicates: true });
}

export async function reviewOverview(auth: Auth, now = new Date()): Promise<ReviewOverview> {
  const db = getDb();
  await syncReviewItems(db, auth.user.id);
  const items = await db.reviewItem.findMany({
    where: { studentId: auth.user.id },
    select: { dueAt: true, lesson: { select: { course: { select: { id: true, slug: true, title: true, status: true } } } } },
  });
  const visible = items.filter((item) => item.lesson.course.status === "published");
  const courses = new Map<string, ReviewOverview["courses"][number]>();
  for (const item of visible) {
    const course = item.lesson.course;
    const entry = courses.get(course.id) ?? { course: { id: course.id, slug: course.slug, title: course.title }, questions: 0, due: 0 };
    entry.questions += 1;
    if (item.dueAt <= now) entry.due += 1;
    courses.set(course.id, entry);
  }
  const upcoming = visible.filter((item) => item.dueAt > now).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];
  const due = visible.filter((item) => item.dueAt <= now).length;
  return {
    due_count: due,
    total_count: visible.length,
    next_due_at: due === 0 && upcoming ? upcoming.dueAt.toISOString() : null,
    courses: [...courses.values()].sort((a, b) => b.due - a.due || a.course.title.localeCompare(b.course.title)),
  };
}

export const reviewSessionInput = z.object({
  mode: z.enum(["review", "practice"]).default("review"),
  course_id: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

/** The questions for one session, in order (answers stay on the server). */
export async function reviewSession(auth: Auth, { mode, course_id, limit }: z.output<typeof reviewSessionInput>, now = new Date()): Promise<ReviewSession> {
  const db = getDb();
  await syncReviewItems(db, auth.user.id);
  const items = await db.reviewItem.findMany({
    where: {
      studentId: auth.user.id,
      lesson: { course: { status: "published", ...(course_id ? { id: course_id } : {}) } },
      ...(mode === "review" ? { dueAt: { lte: now } } : {}),
    },
    include: { lesson: { select: { slug: true, title: true, content: true, course: { select: { slug: true, title: true } } } } },
    // Review: longest overdue first. Practice: weakest first, then the ones seen longest ago.
    orderBy: mode === "review" ? [{ dueAt: "asc" }] : [{ box: "asc" }, { lastReviewedAt: { sort: "asc", nulls: "first" } }],
    take: limit * 2, // some may point at a question removed from its lesson since
  });
  const questions: ReviewQuestion[] = [];
  for (const item of items) {
    const block = checksOf(item.lesson.content).find((check) => check.id === item.blockId);
    if (!block) continue;
    questions.push({
      id: item.id,
      prompt: block.prompt,
      options: block.options,
      lesson: { slug: item.lesson.slug, title: item.lesson.title },
      course: { slug: item.lesson.course.slug, title: item.lesson.course.title },
      strength: strengthLabel(item.box),
    });
    if (questions.length === limit) break;
  }
  return { mode, questions };
}

export const reviewAnswerInput = z.object({
  choice: z.string().trim().min(1).max(40),
  mode: z.enum(["review", "practice"]).default("review"),
});

const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);

/**
 * Checks an answer. In review mode it reschedules the question (right: next box; wrong: back to box 0,
 * tomorrow) and counts as a learning day for the streak. Practice answers change nothing.
 */
export async function answerReview(auth: Auth, itemId: string, { choice, mode }: z.output<typeof reviewAnswerInput>, now = new Date()): Promise<ReviewAnswerResult> {
  const db = getDb();
  const item = await db.reviewItem.findFirst({
    where: { id: itemId, studentId: auth.user.id },
    include: { lesson: { select: { content: true, course: { select: { status: true } } } } },
  });
  if (!item || item.lesson.course.status !== "published") throw notFound("That question");
  const block = checksOf(item.lesson.content).find((check) => check.id === item.blockId);
  if (!block) throw notFound("That question");
  if (!block.options.some((option) => option.id === choice)) throw fieldError("choice", "Choose one of the answers.");

  const correct = choice === block.answer;
  if (mode === "practice") {
    return {
      correct,
      answer: block.answer,
      explanation: block.explanation ?? null,
      scheduled: false,
      next_due_at: item.dueAt.toISOString(),
      interval_days: 0,
      strength: strengthLabel(item.box),
    };
  }
  const next = scheduleReview(item, correct, now);
  await db.$transaction([
    db.reviewItem.update({ where: { id: item.id }, data: { box: next.box, reps: next.reps, lapses: next.lapses, dueAt: next.dueAt, lastReviewedAt: now } }),
    // Reviewing is learning: the day counts for the streak.
    db.learningDay.upsert({
      where: { studentId_day: { studentId: auth.user.id, day: dateOf(localDay(now, auth.user.timezone)) } },
      create: { studentId: auth.user.id, day: dateOf(localDay(now, auth.user.timezone)) },
      update: {},
    }),
  ]);
  return {
    correct,
    answer: block.answer,
    explanation: block.explanation ?? null,
    scheduled: true,
    next_due_at: next.dueAt.toISOString(),
    interval_days: next.intervalDays,
    strength: strengthLabel(next.box),
  };
}

/** Questions due now, for the dashboard and the summary. */
export async function reviewDueCount(studentId: string, now = new Date(), db: Executor = getDb()): Promise<number> {
  return db.reviewItem.count({ where: { studentId, dueAt: { lte: now }, lesson: { course: { status: "published" } } } });
}
