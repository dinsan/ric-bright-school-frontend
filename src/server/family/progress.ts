import "server-only";

import { z } from "zod";
import type { Auth } from "@/server/auth/context";
import { toChild } from "@/server/accounts/serializers";
import { getDb } from "@/server/db";
import { notFound } from "@/server/http/errors";
import { assignmentsOf } from "@/server/learning/assignments";
import { learningStats } from "@/server/learning/service";
import { addDays, levelForXp, localDay, summarizeCourse, xpFor } from "@/features/learn/analytics";
import { dueInfo } from "@/features/learn/assignments";
import { BADGES } from "@/features/learn/badges";
import type { LessonStatus } from "@/features/learn/contract";
import type { UserRow } from "@/server/db";
import type { ChildOverview, ChildProgress, QuizResultRow } from "@/features/family/contract";
import { buildActivity, buildInsights, MISSES_TO_PRACTISE, quizAverage, quizPercent } from "@/features/family/insights";
import { controlsOf } from "./controls";
import { assertParent, ownChild } from "./service";

/**
 * What a parent sees about their children's learning (FE-PAR-01, FE-PAR-02): the dashboard cards and
 * each child's page, also the data of the PDF report. Parents, about their own children only.
 *
 * Computed with the same functions as the child's own dashboard (learningStats, summarizeCourse,
 * assignmentsOf), so a parent never sees different numbers from the child. Days are the child's days
 * (their time zone, UTC when unset), as the streaks are.
 */

export const progressQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) });

const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);
const latest = (...dates: Array<Date | null | undefined>) =>
  dates.reduce<Date | null>((best, date) => (date && (!best || date > best) ? date : best), null);

/** One child's whole picture. `days`: the period of the learning-time numbers (ending today). */
async function loadProgress(child: UserRow, days: number, now: Date): Promise<ChildProgress> {
  const db = getDb();
  const studentId = child.id;
  const today = localDay(now, child.timezone);
  const from = addDays(today, -(days - 1));
  const [{ stats, longestStreak, minutesLast7Days }, enrollments, lessons, periodDays, attempts, badges, certificates, struggles, assignments, controls, lastReview] = await Promise.all([
    learningStats(db, studentId, child.timezone, now),
    db.enrollment.findMany({
      where: { studentId },
      include: {
        course: { select: { id: true, title: true, gradeLevel: true, subject: { select: { name: true } }, lessons: { select: { id: true, slug: true, title: true, position: true }, orderBy: { position: "asc" } } } },
      },
      orderBy: [{ lastActivityAt: "desc" }],
    }),
    db.lessonProgress.findMany({
      where: { studentId },
      select: { lessonId: true, status: true, startedAt: true, completedAt: true, lesson: { select: { title: true, course: { select: { title: true } } } } },
    }),
    db.learningDay.findMany({ where: { studentId, day: { gte: dateOf(from), lte: dateOf(today) } } }),
    db.quizAttempt.findMany({
      where: { studentId },
      include: { quiz: { select: { id: true, title: true, questions: true, course: { select: { title: true } } } } },
      orderBy: { startedAt: "desc" },
    }),
    db.studentBadge.findMany({ where: { studentId }, orderBy: { earnedAt: "desc" } }),
    db.certificate.findMany({ where: { studentId }, orderBy: { issuedAt: "desc" } }),
    db.reviewItem.findMany({ where: { studentId, lapses: { gte: MISSES_TO_PRACTISE } }, select: { lesson: { select: { title: true } } } }),
    assignmentsOf(studentId),
    controlsOf(studentId, db),
    db.reviewItem.findFirst({ where: { studentId, lastReviewedAt: { not: null } }, orderBy: { lastReviewedAt: "desc" }, select: { lastReviewedAt: true } }),
  ]);

  const status = new Map(lessons.map((row) => [row.lessonId, row.status as LessonStatus]));
  const courses = enrollments.map((row) => {
    const summary = summarizeCourse(row.course.lessons, status, row.lastLessonId);
    return {
      id: row.course.id,
      title: row.course.title,
      subject: row.course.subject.name,
      grade_level: row.course.gradeLevel,
      enrolled_at: row.enrolledAt.toISOString(),
      completed_at: row.completedAt?.toISOString() ?? null,
      last_activity_at: row.lastActivityAt.toISOString(),
      lessons_total: summary.lessons_total,
      lessons_completed: summary.lessons_completed,
      percent: summary.percent,
      next_lesson: row.completedAt ? null : (summary.next_lesson?.title ?? null),
    };
  });

  // The latest attempt of each quiz (a quiz taken again shows its newest result).
  const seen = new Set<string>();
  const quizzes: QuizResultRow[] = [];
  for (const attempt of attempts) {
    if (seen.has(attempt.quiz.id)) continue;
    seen.add(attempt.quiz.id);
    const results = attempt.results && typeof attempt.results === "object" ? Object.keys(attempt.results).length : 0;
    quizzes.push({
      quiz: attempt.quiz.title,
      course: attempt.quiz.course.title,
      status: attempt.status,
      score: attempt.status === "submitted" ? attempt.score : null,
      max_score: attempt.status === "submitted" ? attempt.maxScore : null,
      percent: attempt.status === "submitted" ? quizPercent(attempt.score, attempt.maxScore) : null,
      pending_review: attempt.pendingReview,
      question_count: results || (Array.isArray(attempt.quiz.questions) ? attempt.quiz.questions.length : 0),
      started_at: attempt.startedAt.toISOString(),
      submitted_at: attempt.submittedAt?.toISOString() ?? null,
    });
  }
  quizzes.sort((a, b) => (b.submitted_at ?? b.started_at).localeCompare(a.submitted_at ?? a.started_at));

  const byDay = new Map(periodDays.map((row) => [row.day.toISOString().slice(0, 10), row]));
  const learningDays = Array.from({ length: days }, (_, index) => {
    const day = addDays(from, index);
    const row = byDay.get(day);
    return { day, minutes: Math.floor((row?.secondsSpent ?? 0) / 60), lessons_completed: row?.lessonsCompleted ?? 0 };
  });
  const finishedInPeriod = attempts.filter((attempt) => attempt.submittedAt && localDay(attempt.submittedAt, child.timezone) >= from);

  const badgeDefinitions = new Map(BADGES.map((badge) => [badge.id, badge]));
  const earnedBadges = badges.flatMap((row) => {
    const definition = badgeDefinitions.get(row.badge);
    return definition ? [{ name: definition.name, description: definition.description, earned_at: row.earnedAt.toISOString(), earnedAt: row.earnedAt }] : [];
  });

  const child_ = toChild(child);
  const dueRows = assignments.map((row) => {
    const due = dueInfo(row.due_at, row.status, now, child.timezone);
    return {
      id: row.id,
      title: row.title,
      class_name: row.class_name,
      teacher_name: row.teacher_name,
      course: row.course.title,
      lesson: row.lesson?.title ?? null,
      due_at: row.due_at,
      due_label: due.label,
      due_tone: due.tone,
      status: row.status,
      lessons_done: row.lessons_done,
      lessons_total: row.lessons_total,
    };
  });
  const lastActive = latest(
    ...enrollments.map((row) => row.lastActivityAt),
    ...attempts.map((row) => row.submittedAt ?? row.startedAt),
    lastReview?.lastReviewedAt,
  );
  const xp = xpFor({ lessonsCompleted: stats.lessons_completed, coursesCompleted: stats.courses_completed });

  return {
    child: child_,
    generated_at: now.toISOString(),
    period: {
      days,
      from,
      to: today,
      minutes: learningDays.reduce((sum, row) => sum + row.minutes, 0),
      active_days: periodDays.length,
      lessons_completed: learningDays.reduce((sum, row) => sum + row.lessons_completed, 0),
      quizzes_finished: finishedInPeriod.length,
    },
    summary: {
      last_active_at: lastActive?.toISOString() ?? null,
      streak_days: stats.streak_days,
      longest_streak_days: longestStreak,
      minutes_last_7_days: minutesLast7Days,
      minutes_total: stats.minutes_total,
      lessons_completed: stats.lessons_completed,
      courses_completed: stats.courses_completed,
      xp,
      level: levelForXp(xp).level,
      badges_earned: earnedBadges.length,
      quiz_average_percent: quizAverage(quizzes),
    },
    courses,
    quizzes,
    assignments: dueRows,
    learning_days: learningDays,
    badges: earnedBadges.map(({ name, description, earned_at }) => ({ name, description, earned_at })),
    certificates: certificates.map((row) => ({ course: row.courseTitle, code: row.code, issued_at: row.issuedAt.toISOString() })),
    activity: buildActivity({
      enrollments: enrollments.map((row) => ({ course: row.course.title, enrolledAt: row.enrolledAt })),
      lessons: lessons.map((row) => ({ course: row.lesson.course.title, lesson: row.lesson.title, startedAt: row.startedAt, completedAt: row.completedAt })),
      quizzes: attempts.filter((row) => row.status === "submitted").map((row) => ({
        quiz: row.quiz.title,
        course: row.quiz.course.title,
        status: row.status,
        score: row.score,
        max_score: row.maxScore,
        percent: quizPercent(row.score, row.maxScore),
        pending_review: row.pendingReview,
        question_count: 0,
        started_at: row.startedAt.toISOString(),
        submitted_at: row.submittedAt?.toISOString() ?? null,
      })),
      badges: earnedBadges.map((row) => ({ name: row.name, earnedAt: row.earnedAt })),
      certificates: certificates.map((row) => ({ course: row.courseTitle, issuedAt: row.issuedAt })),
    }),
    insights: buildInsights({
      courses: courses.map((course) => ({ title: course.title, completed: course.completed_at !== null, percent: course.percent })),
      quizzes,
      streak_days: stats.streak_days,
      missed_review_lessons: [...new Set(struggles.map((row) => row.lesson.title))],
      overdue_work: dueRows.filter((row) => row.due_tone === "overdue").map((row) => row.title),
    }),
    controls,
  };
}

async function ownChildOrNotFound(auth: Auth, childId: string): Promise<UserRow> {
  assertParent(auth);
  const child = await ownChild(auth.user.id, childId);
  if (!child) throw notFound("That child");
  return child;
}

/** One child's page (and report): their courses, quizzes, work, learning time, activity and insights. */
export async function childProgress(auth: Auth, childId: string, { days }: z.output<typeof progressQuery> = { days: 14 }, now = new Date()): Promise<ChildProgress> {
  return loadProgress(await ownChildOrNotFound(auth, childId), days, now);
}

/** The parent's dashboard: a card per child, in the order the children were added. */
export async function childrenOverview(auth: Auth, now = new Date()): Promise<ChildOverview[]> {
  assertParent(auth);
  const rows = await getDb().guardianship.findMany({
    where: { parentId: auth.user.id },
    include: { child: true },
    orderBy: [{ createdAt: "asc" }, { child: { displayName: "asc" } }],
  });
  return Promise.all(
    rows.map(async ({ child }) => {
      const progress = await loadProgress(child, 7, now);
      const open = progress.assignments.filter((row) => row.status !== "done");
      return {
        child: progress.child,
        last_active_at: progress.summary.last_active_at,
        streak_days: progress.summary.streak_days,
        minutes_last_7_days: progress.summary.minutes_last_7_days,
        lessons_completed: progress.summary.lessons_completed,
        courses_in_progress: progress.courses.filter((course) => !course.completed_at).length,
        courses_completed: progress.summary.courses_completed,
        level: progress.summary.level,
        latest_quiz: progress.quizzes.find((row) => row.status === "submitted") ?? null,
        work: {
          overdue: open.filter((row) => row.due_tone === "overdue").length,
          due_soon: open.filter((row) => row.due_tone === "today" || row.due_tone === "soon").length,
        },
        controls: progress.controls,
      };
    }),
  );
}
