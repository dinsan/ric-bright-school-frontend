import type { CourseProgressSummary, LessonRef, LessonStatus } from "./contract";

/**
 * Learning analytics: the numbers the student experience shows (progress, "continue", streaks, XP,
 * levels, minutes). Pure functions over progress records, shared by the server (GET /learn/summary)
 * and the browser (optimistic updates), so both always agree.
 *
 * Rules for this module (FE-MOB-02): no DOM, no React, no Next.js, no database — plain data in, plain
 * data out, so the mobile app can reuse it and unit tests need nothing.
 *
 * First-party only: these numbers are computed from the student's own progress in Lumina's database.
 * Nothing here sends data anywhere (no analytics scripts: see FE-SEC-04 and FE-SEC-06).
 */

// --- Course progress ------------------------------------------------------------------------------

/** 0 to 100, rounded down, so 100 % only ever means "every lesson done". */
export function percentComplete(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((completed / total) * 100));
}

/**
 * A course's progress and where "Continue" goes. `status` maps lesson ids to the student's status
 * (missing = not started). The next lesson is the one last opened if it isn't finished (resume where
 * you left off), otherwise the first unfinished lesson in course order.
 */
export function summarizeCourse(
  lessons: readonly LessonRef[],
  status: ReadonlyMap<string, LessonStatus> | Readonly<Record<string, LessonStatus>>,
  lastLessonId: string | null = null,
): CourseProgressSummary {
  const statusOf = (lessonId: string): LessonStatus =>
    (status instanceof Map ? status.get(lessonId) : (status as Record<string, LessonStatus>)[lessonId]) ?? "not_started";
  const ordered = [...lessons].sort((a, b) => a.position - b.position);
  const completed = ordered.filter((lesson) => statusOf(lesson.id) === "completed").length;
  const last = lastLessonId ? ordered.find((lesson) => lesson.id === lastLessonId) : undefined;
  const next = last && statusOf(last.id) !== "completed" ? last : ordered.find((lesson) => statusOf(lesson.id) !== "completed");
  return {
    lessons_total: ordered.length,
    lessons_completed: completed,
    percent: percentComplete(completed, ordered.length),
    next_lesson: next ? { id: next.id, slug: next.slug, title: next.title, position: next.position } : null,
  };
}

// --- Days and streaks -----------------------------------------------------------------------------

/** A calendar day as "YYYY-MM-DD". */
export type Day = string;

/**
 * The calendar day of `date` in `timeZone` (the student's; falls back to UTC when missing or unknown).
 * Streaks are counted in the student's own days, so learning at 9 pm doesn't land on "tomorrow".
 */
export function localDay(date: Date, timeZone?: string | null): Day {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  if (timeZone) {
    try {
      return format(timeZone);
    } catch {
      // Unknown zone name: fall through to UTC.
    }
  }
  return format("UTC");
}

/** `day` moved by `amount` days (negative goes back). */
export function addDays(day: Day, amount: number): Day {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/**
 * Streaks from the days that had learning. The current streak counts back from today, or from
 * yesterday while today has nothing yet (a streak isn't lost until the day is over).
 */
export function streaks(activeDays: Iterable<Day>, today: Day): { current: number; longest: number } {
  const days = new Set(activeDays);
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let longest = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // not the start of a run
    let length = 1;
    while (days.has(addDays(day, length))) length += 1;
    longest = Math.max(longest, length);
  }
  return { current, longest: Math.max(longest, current) };
}

/** Whole minutes of learning in the 7 days ending with `today` (today included). */
export function minutesInLastDays(days: Iterable<{ day: Day; seconds: number }>, today: Day, count = 7): number {
  const from = addDays(today, -(count - 1));
  let seconds = 0;
  for (const entry of days) if (entry.day >= from && entry.day <= today) seconds += entry.seconds;
  return Math.floor(seconds / 60);
}

// --- XP and levels ------------------------------------------------------------------------------------

/** How much each achievement is worth. Change here, and the server and the browser follow. */
export const XP_RULES = { lessonCompleted: 10, courseCompleted: 50 } as const;

export function xpFor({ lessonsCompleted, coursesCompleted }: { lessonsCompleted: number; coursesCompleted: number }): number {
  return lessonsCompleted * XP_RULES.lessonCompleted + coursesCompleted * XP_RULES.courseCompleted;
}

/** XP needed to go from `level` to the next: 100 for level 1, then 50 more each level (100, 150, 200…). */
export function xpToNextLevel(level: number): number {
  return 100 + 50 * (level - 1);
}

/** The level for an XP total, with how far into it the student is (for a progress bar). */
export function levelForXp(xp: number): { level: number; xp_into_level: number; xp_for_next_level: number } {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }
  return { level, xp_into_level: remaining, xp_for_next_level: xpToNextLevel(level) };
}
