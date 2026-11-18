import { z } from "zod";

/**
 * Parental controls (FE-PAR-03): a daily learning-time limit and a bedtime, and what happens when one is
 * reached: a reminder (the child can carry on) or a pause (lessons, quizzes and review show a "time for a
 * break" screen; everything done so far is saved). Set by a parent (src/server/family/controls.ts), shown
 * to the child by the student area. Pure and shared: the server validates with these schemas, the
 * browser works out the state with the same functions.
 *
 * Learning time is the time spent in lessons (what the lesson player reports), in the child's own days.
 * Bedtime is read on the child's device clock, so it follows where the child is.
 */

export const DAILY_MINUTE_CHOICES = [15, 30, 45, 60, 90, 120] as const;
export const CONTROL_ACTIONS = ["remind", "pause"] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = z.string().regex(TIME, "Use a time like 20:00.");

export const parentalControlsInput = z.object({
  daily_minutes: z
    .number()
    .int()
    .refine((value) => (DAILY_MINUTE_CHOICES as readonly number[]).includes(value), "Choose one of the times offered.")
    .nullable(),
  bedtime: z
    .object({ start: time, end: time })
    .refine((value) => value.start !== value.end, { message: "Bedtime needs different start and end times.", path: ["end"] })
    .nullable(),
  when_reached: z.enum(CONTROL_ACTIONS),
});

export type ParentalControlsSettings = z.output<typeof parentalControlsInput>;

export const NO_CONTROLS: ParentalControlsSettings = { daily_minutes: null, bedtime: null, when_reached: "remind" };

/** The controls as the child's app reads them: GET /learn/controls. */
export interface StudentControls extends ParentalControlsSettings {
  /** Minutes of learning so far today (the child's day). */
  minutes_today: number;
}

export type ControlState =
  | { kind: "ok" }
  | { kind: "bedtime"; until: string; pause: boolean }
  | { kind: "time_up"; limit: number; pause: boolean };

/** "20:30" → 1230. */
export function minutesOfDay(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

/** Whether `minute` (of the day) falls in the bedtime window, which may run past midnight (20:00 to 07:00). */
export function inBedtime(bedtime: { start: string; end: string }, minute: number): boolean {
  const start = minutesOfDay(bedtime.start);
  const end = minutesOfDay(bedtime.end);
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/**
 * Where the child stands now. Bedtime comes first (it is about the time of day); then the daily limit.
 * `now` is read in the device's local time.
 */
export function controlState(controls: StudentControls, now: Date): ControlState {
  const pause = controls.when_reached === "pause";
  if (controls.bedtime && inBedtime(controls.bedtime, now.getHours() * 60 + now.getMinutes())) {
    return { kind: "bedtime", until: controls.bedtime.end, pause };
  }
  if (controls.daily_minutes !== null && controls.minutes_today >= controls.daily_minutes) {
    return { kind: "time_up", limit: controls.daily_minutes, pause };
  }
  return { kind: "ok" };
}

export const hasControls = (settings: ParentalControlsSettings) => settings.daily_minutes !== null || settings.bedtime !== null;

/** The controls in plain sentences, for the parent's pages and the report. */
export function describeControls(settings: ParentalControlsSettings): string[] {
  if (!hasControls(settings)) return ["No limits set."];
  const lines: string[] = [];
  if (settings.daily_minutes !== null) lines.push(`Up to ${formatMinutes(settings.daily_minutes)} of lessons a day.`);
  if (settings.bedtime) lines.push(`Bedtime from ${settings.bedtime.start} to ${settings.bedtime.end}.`);
  lines.push(settings.when_reached === "pause" ? "Then lessons and quizzes pause until the next day (or the end of bedtime)." : "Then a reminder to take a break.");
  return lines;
}

/** 45 → "45 minutes", 90 → "1 hour 30 minutes", 60 → "1 hour". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const parts = [hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "", minutes || !hours ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}` : ""];
  return parts.filter(Boolean).join(" ");
}
