import "server-only";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Auth } from "@/server/auth/context";
import { getDb, type Executor } from "@/server/db";
import { forbidden, HttpError, notFound } from "@/server/http/errors";
import { localDay } from "@/features/learn/analytics";
import type { QuizAttempt, QuizAttemptSaved, QuizResult, QuizSummary, QuizView } from "@/features/learn/contract";
import {
  answerSchemaFor,
  gradeQuiz,
  isAnswered,
  MAX_QUESTIONS,
  parseQuestions,
  parseQuizSettings,
  toQuizQuestion,
  type QuestionDefinition,
  type QuestionResult,
  type QuizAnswer,
  type QuizAnswers,
} from "@/features/learn/quiz";

/**
 * Quizzes (FE-ASM-01, FE-ASM-02): the quizzes of a course, taking one (an attempt), saving answers as the
 * student goes, and submitting. Under /api/learn, students only, always about the signed-in student.
 *
 * - A quiz is visible like its course's lessons (published, or a course the student is taking) and can be
 *   taken once the course is started.
 * - Answers never leave the server: the browser gets the public questions (`toQuizQuestion`).
 * - One attempt in progress per student and quiz: starting again while one is open returns it.
 * - Saving sends the whole state; submitting marks it (quiz.ts) and freezes it. Submitting twice returns
 *   the same result, so a retried request is harmless.
 */

function assertStudent(auth: Auth) {
  if (auth.user.role !== "student") throw forbidden("Only students take quizzes.");
}

const notEnrolled = () => new HttpError(409, "not_enrolled", "Start the course first, then its quizzes.");
const alreadySubmitted = () => new HttpError(409, "attempt_submitted", "This quiz is already finished, so its answers can't change.");

/** The stored questions, valid ones only (invalid ones are logged for the author). */
function questionsOf(quiz: { id: string; questions: unknown }): QuestionDefinition[] {
  const { questions, dropped } = parseQuestions(quiz.questions);
  if (dropped > 0) console.warn(`[quizzes] quiz ${quiz.id}: ${dropped} invalid question(s) left out`);
  return questions;
}

const asAnswers = (value: unknown): QuizAnswers => (value && typeof value === "object" && !Array.isArray(value) ? (value as QuizAnswers) : {});
const asFlagged = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);
const asResults = (value: unknown): Record<string, QuestionResult> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, QuestionResult>) : {};

type AttemptRow = {
  id: string;
  status: "in_progress" | "submitted";
  answers: unknown;
  flagged: unknown;
  results: unknown;
  score: number | null;
  maxScore: number | null;
  startedAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
};

function toAttempt(row: AttemptRow): QuizAttempt {
  return {
    id: row.id,
    status: row.status,
    answers: asAnswers(row.answers),
    flagged: asFlagged(row.flagged),
    started_at: row.startedAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** A finished attempt's result, from what was stored when it was marked. */
function toResult(row: AttemptRow): QuizResult {
  const results = Object.values(asResults(row.results));
  const pending = results.filter((result) => result.correct === null);
  return {
    attempt_id: row.id,
    score: row.score ?? 0,
    max_score: row.maxScore ?? 0,
    pending_review: pending.length,
    pending_points: pending.reduce((sum, result) => sum + (result.max ?? 0), 0),
    answered: results.filter((result) => result.answered).length,
    question_count: results.length,
    submitted_at: (row.submittedAt ?? row.updatedAt).toISOString(),
  };
}

const answeredCount = (questions: QuestionDefinition[], answers: QuizAnswers) => questions.filter((question) => isAnswered(question, answers[question.id])).length;

/** The quiz, if this student may see it (published course, or one they're taking), with their enrolment. */
async function visibleQuiz(auth: Auth, quizId: string, db: Executor = getDb()) {
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, include: { course: { select: { id: true, slug: true, title: true, status: true } } } });
  if (!quiz) throw notFound("That quiz");
  const enrollment = await db.enrollment.findUnique({ where: { studentId_courseId: { studentId: auth.user.id, courseId: quiz.courseId } }, select: { id: true } });
  if (quiz.course.status !== "published" && !enrollment) throw notFound("That quiz");
  return { quiz, enrollment };
}

/** A quiz's id from its course and quiz slugs (the player's URL), or null. */
export async function findQuizId(courseSlug: string, quizSlug: string): Promise<string | null> {
  if (courseSlug.length > 120 || quizSlug.length > 120) return null;
  const row = await getDb().quiz.findFirst({ where: { slug: quizSlug, course: { slug: courseSlug } }, select: { id: true } });
  return row?.id ?? null;
}

/** The quizzes of a course, in order, with the student's attempt in progress and last result on each. */
export async function courseQuizzes(auth: Auth, courseId: string): Promise<QuizSummary[]> {
  assertStudent(auth);
  const db = getDb();
  const [course, enrollment] = await Promise.all([
    db.course.findUnique({ where: { id: courseId }, select: { status: true } }),
    db.enrollment.findUnique({ where: { studentId_courseId: { studentId: auth.user.id, courseId } }, select: { id: true } }),
  ]);
  if (!course || (course.status !== "published" && !enrollment)) throw notFound("That course");
  const quizzes = await db.quiz.findMany({
    where: { courseId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { attempts: { where: { studentId: auth.user.id }, orderBy: { startedAt: "desc" } } },
  });
  return quizzes.map((quiz) => {
    const questions = questionsOf(quiz);
    const open = quiz.attempts.find((attempt) => attempt.status === "in_progress");
    const last = quiz.attempts.find((attempt) => attempt.status === "submitted");
    return {
      id: quiz.id,
      slug: quiz.slug,
      title: quiz.title,
      description: quiz.description,
      question_count: questions.length,
      layout: parseQuizSettings(quiz.settings).layout,
      in_progress: open ? { answered: answeredCount(questions, asAnswers(open.answers)), started_at: open.startedAt.toISOString() } : null,
      last_result: last ? toResult(last) : null,
    };
  });
}

/** Everything the quiz player shows. Questions (without answers) only once the course is started. */
export async function quizView(auth: Auth, quizId: string): Promise<QuizView> {
  assertStudent(auth);
  const db = getDb();
  const { quiz, enrollment } = await visibleQuiz(auth, quizId, db);
  const questions = questionsOf(quiz);
  const attempts = await db.quizAttempt.findMany({ where: { studentId: auth.user.id, quizId }, orderBy: { startedAt: "desc" }, take: 10 });
  const open = attempts.find((attempt) => attempt.status === "in_progress");
  const last = attempts.find((attempt) => attempt.status === "submitted");
  return {
    course: { id: quiz.course.id, slug: quiz.course.slug, title: quiz.course.title },
    quiz: {
      id: quiz.id,
      slug: quiz.slug,
      title: quiz.title,
      description: quiz.description,
      layout: parseQuizSettings(quiz.settings).layout,
      question_count: questions.length,
      points_total: questions.reduce((sum, question) => sum + question.points, 0),
    },
    enrolled: enrollment !== null,
    questions: enrollment ? questions.map(toQuizQuestion) : [],
    attempt: enrollment && open ? toAttempt(open) : null,
    last_result: last ? toResult(last) : null,
  };
}

/**
 * Starts the quiz, or carries on with the attempt already in progress (`created: false`). Serialized per
 * student and course by locking the enrolment row, so a double click or two tabs never open two attempts.
 */
export async function startQuizAttempt(auth: Auth, quizId: string): Promise<{ attempt: QuizAttempt; created: boolean }> {
  assertStudent(auth);
  const db = getDb();
  const { quiz, enrollment } = await visibleQuiz(auth, quizId, db);
  if (!enrollment) throw notEnrolled();
  if (questionsOf(quiz).length === 0) throw new HttpError(409, "quiz_empty", "This quiz has no questions yet.");
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`select id from enrollments where id = ${enrollment.id}::uuid for update`;
    if (locked.length === 0) throw notEnrolled();
    const open = await tx.quizAttempt.findFirst({ where: { studentId: auth.user.id, quizId, status: "in_progress" }, orderBy: { startedAt: "desc" } });
    if (open) return { attempt: toAttempt(open), created: false };
    const created = await tx.quizAttempt.create({ data: { studentId: auth.user.id, quizId } });
    return { attempt: toAttempt(created), created: true };
  });
}

export const quizAttemptSaveInput = z.object({
  answers: z.record(z.string().max(40), z.unknown()).refine((value) => Object.keys(value).length <= MAX_QUESTIONS, "Too many answers."),
  flagged: z.array(z.string().max(40)).max(MAX_QUESTIONS).default([]),
});

/** Submitting may carry the last answers (nothing is lost between the last autosave and pressing Finish). */
export const quizSubmitInput = quizAttemptSaveInput.partial();

/**
 * Checks every answer against its question (shape, lengths, ids). Answers and flags for questions that are
 * no longer in the quiz are dropped quietly: a quiz edited during an attempt mustn't block saving.
 */
function cleanAnswers(questions: QuestionDefinition[], input: { answers?: Record<string, unknown>; flagged?: string[] }, fallback: { answers: QuizAnswers; flagged: string[] }) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const answers: QuizAnswers = {};
  for (const [questionId, value] of Object.entries(input.answers ?? fallback.answers)) {
    const question = byId.get(questionId);
    if (!question || value === null || value === undefined) continue;
    const parsed = answerSchemaFor(question).safeParse(value);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Check this answer.";
      throw new HttpError(422, "validation_error", "Check the highlighted answers.", { details: [{ field: `body.answers.${questionId}`, message }] });
    }
    answers[questionId] = parsed.data as QuizAnswer;
  }
  const flagged = [...new Set(input.flagged ?? fallback.flagged)].filter((questionId) => byId.has(questionId));
  return { answers, flagged };
}

async function ownAttempt(auth: Auth, attemptId: string, db: Executor = getDb()) {
  const attempt = await db.quizAttempt.findFirst({ where: { id: attemptId, studentId: auth.user.id }, include: { quiz: { select: { id: true, questions: true } } } });
  if (!attempt) throw notFound("That quiz attempt");
  return attempt;
}

/** Autosave: replaces the attempt's answers and flags. 409 once the attempt is submitted. */
export async function saveQuizAttempt(auth: Auth, attemptId: string, input: z.output<typeof quizAttemptSaveInput>): Promise<QuizAttemptSaved> {
  assertStudent(auth);
  const db = getDb();
  const attempt = await ownAttempt(auth, attemptId, db);
  if (attempt.status !== "in_progress") throw alreadySubmitted();
  const { answers, flagged } = cleanAnswers(questionsOf(attempt.quiz), input, { answers: {}, flagged: [] });
  // Only while still in progress: a save arriving after the submit (a slow request) changes nothing.
  const [updated] = await db.quizAttempt.updateManyAndReturn({
    where: { id: attempt.id, status: "in_progress" },
    data: { answers: answers as Prisma.InputJsonObject, flagged },
    select: { updatedAt: true },
  });
  if (!updated) throw alreadySubmitted();
  return { saved_at: updated.updatedAt.toISOString() };
}

const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);

/**
 * Finishes the attempt: the answers sent with it (or the last ones saved) are marked and frozen. A quiz
 * counts as learning for the day (the streak). Submitting again returns the same result.
 */
export async function submitQuizAttempt(auth: Auth, attemptId: string, input: z.output<typeof quizSubmitInput>, now = new Date()): Promise<QuizResult> {
  assertStudent(auth);
  const db = getDb();
  return db.$transaction(async (tx) => {
    // Lock the attempt: a submit and a retry of it (or a save) never interleave.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`select id from quiz_attempts where id = ${attemptId}::uuid and student_id = ${auth.user.id}::uuid for update`;
    if (locked.length === 0) throw notFound("That quiz attempt");
    const attempt = await ownAttempt(auth, attemptId, tx);
    if (attempt.status === "submitted") return toResult(attempt);

    const questions = questionsOf(attempt.quiz);
    const { answers } = cleanAnswers(questions, input, { answers: asAnswers(attempt.answers), flagged: asFlagged(attempt.flagged) });
    const grade = gradeQuiz(questions, answers);
    const submitted = await tx.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "submitted",
        answers: answers as Prisma.InputJsonObject,
        flagged: [],
        results: grade.results as unknown as Prisma.InputJsonObject,
        score: grade.score,
        maxScore: grade.max_score,
        pendingReview: grade.pending_review,
        submittedAt: now,
      },
    });
    const day = dateOf(localDay(now, auth.user.timezone));
    await tx.learningDay.upsert({ where: { studentId_day: { studentId: auth.user.id, day } }, create: { studentId: auth.user.id, day }, update: {} });
    return toResult(submitted);
  });
}
