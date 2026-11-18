import { localDay } from "./analytics";

/**
 * Assigned work from a student's point of view (FE-STU-01, FE-TCH-07): how far along it is and how its
 * due date reads ("Due tomorrow", "Overdue by 2 days"), in the student's own calendar days. Pure.
 */

export type AssignmentStatus = "not_started" | "in_progress" | "done";
export type DueTone = "overdue" | "today" | "soon" | "later" | "done";

export function assignmentStatus(lessonsDone: number, lessonsTotal: number, anyStarted: boolean): AssignmentStatus {
  if (lessonsTotal > 0 && lessonsDone >= lessonsTotal) return "done";
  return lessonsDone > 0 || anyStarted ? "in_progress" : "not_started";
}

const dayNumber = (day: string) => Math.round(new Date(`${day}T00:00:00Z`).getTime() / 86_400_000);
const dateFormatter = (timeZone: string | null | undefined) => {
  try {
    return new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", timeZone: timeZone ?? "UTC" });
  } catch {
    return new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }
};

/** How a due date reads for the student today, and how urgent it is. "Soon" means within 7 days. */
export function dueInfo(dueAt: string, status: AssignmentStatus, now: Date, timeZone?: string | null): { label: string; tone: DueTone; days: number } {
  const days = dayNumber(localDay(new Date(dueAt), timeZone)) - dayNumber(localDay(now, timeZone));
  const on = dateFormatter(timeZone).format(new Date(dueAt));
  if (status === "done") return { label: `Done · was due ${on}`, tone: "done", days };
  if (days < 0) return { label: days === -1 ? "Was due yesterday" : `Overdue by ${-days} days`, tone: "overdue", days };
  if (days === 0) return { label: "Due today", tone: "today", days };
  if (days === 1) return { label: "Due tomorrow", tone: "soon", days };
  if (days <= 7) return { label: `Due in ${days} days (${on})`, tone: "soon", days };
  return { label: `Due ${on}`, tone: "later", days };
}
