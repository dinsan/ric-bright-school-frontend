/**
 * Spaced review (FE-STU-10, BE-LRN-08): when a question from a finished lesson comes back. A Leitner
 * system, simple enough to explain to a child: every right answer moves the question to the next box,
 * seen less often (1, 3, 7, 14, 30, 60, 120 days); a wrong answer sends it back to the first box, seen
 * again tomorrow. Pure: the server schedules with it, the browser explains it ("Next review in 3 days").
 */

export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;
export const MAX_BOX = REVIEW_INTERVALS_DAYS.length - 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewState {
  box: number;
  reps: number;
  lapses: number;
}

export interface Scheduled extends ReviewState {
  dueAt: Date;
  intervalDays: number;
}

/** The next state of a review item after an answer. */
export function scheduleReview(state: ReviewState, correct: boolean, now: Date): Scheduled {
  const box = correct ? Math.min(MAX_BOX, Math.max(0, state.box) + 1) : 0;
  const intervalDays = REVIEW_INTERVALS_DAYS[box]!;
  return {
    box,
    reps: state.reps + 1,
    lapses: state.lapses + (correct ? 0 : 1),
    intervalDays,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}

/** When a newly finished lesson's questions first come back: the next day. */
export function firstReviewAt(completedAt: Date): Date {
  return new Date(completedAt.getTime() + REVIEW_INTERVALS_DAYS[0] * DAY_MS);
}

/** "tomorrow", "in 3 days", "in 2 weeks", "in about a month", "in about 4 months". */
export function describeInterval(days: number): string {
  if (days <= 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 30) return `in ${Math.round(days / 7)} weeks`;
  if (days < 45) return "in about a month";
  return `in about ${Math.round(days / 30)} months`;
}

/** How well a question is known, in words, from its box. */
export function strengthLabel(box: number): "new" | "learning" | "known" | "mastered" {
  if (box <= 0) return "new";
  if (box <= 2) return "learning";
  if (box <= 4) return "known";
  return "mastered";
}
