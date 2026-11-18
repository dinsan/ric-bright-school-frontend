import type { ActivityItem, QuizResultRow } from "./contract";

/**
 * What a parent reads about a child's learning (FE-PAR-02): the recent-activity list, and "doing well" /
 * "worth practising" in plain sentences. Simple rules a parent can check against the numbers on the same
 * page, never a hidden score. Pure: unit-tested, used by the page and the PDF report alike.
 */

/** A quiz counts as "doing well" from this percentage, and as "worth practising" below the other. */
export const STRONG_PERCENT = 80;
export const PRACTISE_PERCENT = 60;
/** A review question missed this many times marks its lesson as worth practising. */
export const MISSES_TO_PRACTISE = 2;
const MAX_ACTIVITY = 25;
const MAX_INSIGHTS = 5;

export interface ActivityInput {
  enrollments: Array<{ course: string; enrolledAt: Date }>;
  lessons: Array<{ course: string; lesson: string; startedAt: Date; completedAt: Date | null }>;
  quizzes: QuizResultRow[];
  badges: Array<{ name: string; earnedAt: Date }>;
  certificates: Array<{ course: string; issuedAt: Date }>;
}

/**
 * Everything that happened, newest first. A lesson shows once: finished, or started while it isn't
 * finished yet (so a parent doesn't read the same lesson twice).
 */
export function buildActivity(input: ActivityInput, limit = MAX_ACTIVITY): ActivityItem[] {
  const items: ActivityItem[] = [
    ...input.enrollments.map((row) => ({ at: row.enrolledAt.toISOString(), kind: "course_started" as const, text: `Started the course “${row.course}”`, course: row.course })),
    ...input.lessons.map((row) =>
      row.completedAt
        ? { at: row.completedAt.toISOString(), kind: "lesson_completed" as const, text: `Finished the lesson “${row.lesson}”`, course: row.course }
        : { at: row.startedAt.toISOString(), kind: "lesson_started" as const, text: `Opened the lesson “${row.lesson}”`, course: row.course },
    ),
    ...input.quizzes
      .filter((row) => row.status === "submitted" && row.submitted_at)
      .map((row) => ({ at: row.submitted_at!, kind: "quiz_finished" as const, text: `Finished the quiz “${row.quiz}”: ${scoreText(row)}`, course: row.course })),
    ...input.badges.map((row) => ({ at: row.earnedAt.toISOString(), kind: "badge" as const, text: `Earned the badge “${row.name}”`, course: null })),
    ...input.certificates.map((row) => ({ at: row.issuedAt.toISOString(), kind: "certificate" as const, text: `Earned the certificate for “${row.course}”`, course: row.course })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** "7 of 8 points (88%)", "no points marked yet", "in progress". */
export function scoreText(row: Pick<QuizResultRow, "status" | "score" | "max_score" | "percent" | "pending_review">): string {
  if (row.status !== "submitted") return "in progress";
  if (!row.max_score) return "written answers, not marked yet";
  return `${row.score ?? 0} of ${row.max_score} points (${row.percent}%)`;
}

/** Percent of the marked points, rounded; null when nothing was marked. */
export function quizPercent(score: number | null, maxScore: number | null): number | null {
  return maxScore ? Math.round(((score ?? 0) / maxScore) * 100) : null;
}

export interface InsightInput {
  courses: Array<{ title: string; completed: boolean; percent: number }>;
  /** The latest attempt of each quiz. */
  quizzes: QuizResultRow[];
  streak_days: number;
  /** Lessons whose review questions were missed MISSES_TO_PRACTISE times or more. */
  missed_review_lessons: string[];
  overdue_work: string[];
}

export function buildInsights(input: InsightInput): { doing_well: string[]; to_practise: string[] } {
  const finished = input.quizzes.filter((row) => row.status === "submitted" && row.percent !== null);
  const doingWell = [
    ...input.courses.filter((course) => course.completed).map((course) => `Finished the course “${course.title}”.`),
    ...finished.filter((row) => row.percent! >= STRONG_PERCENT).map((row) => `Scored ${row.percent}% in the quiz “${row.quiz}”.`),
    ...(input.streak_days >= 3 ? [`Learned ${input.streak_days} days in a row.`] : []),
  ];
  const toPractise = [
    ...finished.filter((row) => row.percent! < PRACTISE_PERCENT).map((row) => `The quiz “${row.quiz}” (${row.percent}%): worth taking again.`),
    ...input.missed_review_lessons.map((lesson) => `Review questions from “${lesson}” were missed more than once.`),
    ...input.overdue_work.map((title) => `“${title}” from school is overdue.`),
  ];
  return { doing_well: doingWell.slice(0, MAX_INSIGHTS), to_practise: toPractise.slice(0, MAX_INSIGHTS) };
}

/** Average of the latest finished quizzes (percent), or null. */
export function quizAverage(quizzes: QuizResultRow[]): number | null {
  const marked = quizzes.filter((row) => row.status === "submitted" && row.percent !== null);
  return marked.length ? Math.round(marked.reduce((sum, row) => sum + row.percent!, 0) / marked.length) : null;
}

/** "Active today", "Active yesterday", "Active 3 days ago", "Not active yet", in the parent's days. */
export function lastActiveLabel(lastActiveAt: string | null, now: Date, timeZone?: string | null): string {
  if (!lastActiveAt) return "Not active yet";
  const day = (date: Date) => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC" }).format(date);
    } catch {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(date);
    }
  };
  const days = Math.round((Date.parse(day(now)) - Date.parse(day(new Date(lastActiveAt)))) / 86_400_000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  return `Active ${days} days ago`;
}
