import "server-only";

import type { Auth } from "@/server/auth/context";
import { getDb, type Executor } from "@/server/db";
import { forbidden, notFound } from "@/server/http/errors";
import { localDay } from "@/features/learn/analytics";
import { NO_CONTROLS, type ParentalControlsSettings, type StudentControls } from "@/features/learn/controls";
import type { ParentalControlsView } from "@/features/family/contract";
import { assertParent, ownChild } from "./service";

/**
 * Parental controls (FE-PAR-03): any of the child's parents or guardians sets them (one set per child),
 * the child's app reads them (GET /learn/controls) and shows the reminder or the pause. The rules:
 * src/features/learn/controls.ts.
 */

type Row = { dailyMinutes: number | null; bedtimeStart: string | null; bedtimeEnd: string | null; whenReached: "remind" | "pause" };

function toSettings(row: Row | null): ParentalControlsSettings {
  if (!row) return NO_CONTROLS;
  return {
    daily_minutes: row.dailyMinutes,
    bedtime: row.bedtimeStart && row.bedtimeEnd ? { start: row.bedtimeStart, end: row.bedtimeEnd } : null,
    when_reached: row.whenReached,
  };
}

export async function controlsOf(childId: string, db: Executor = getDb()): Promise<ParentalControlsSettings> {
  return toSettings(await db.parentalControls.findUnique({ where: { childId } }));
}

async function view(auth: Auth, childId: string, db: Executor): Promise<ParentalControlsView> {
  const row = await db.parentalControls.findUnique({ where: { childId }, include: { updatedBy: { select: { id: true, displayName: true } } } });
  return {
    ...toSettings(row),
    updated_at: row?.updatedAt.toISOString() ?? null,
    updated_by: row?.updatedBy ? (row.updatedBy.id === auth.user.id ? "you" : row.updatedBy.displayName) : null,
  };
}

/** A parent reads the controls of one of their children. */
export async function childControls(auth: Auth, childId: string): Promise<ParentalControlsView> {
  assertParent(auth);
  if (!(await ownChild(auth.user.id, childId))) throw notFound("That child");
  return view(auth, childId, getDb());
}

/** A parent sets them (the whole set each time). No limits at all removes the row. */
export async function updateChildControls(auth: Auth, childId: string, input: ParentalControlsSettings): Promise<ParentalControlsView> {
  assertParent(auth);
  if (!(await ownChild(auth.user.id, childId))) throw notFound("That child");
  const db = getDb();
  const data = {
    dailyMinutes: input.daily_minutes,
    bedtimeStart: input.bedtime?.start ?? null,
    bedtimeEnd: input.bedtime?.end ?? null,
    whenReached: input.when_reached,
    updatedById: auth.user.id,
  };
  await db.parentalControls.upsert({ where: { childId }, create: { childId, ...data }, update: data });
  return view(auth, childId, db);
}

/** The child's own app: the controls and today's learning minutes (their day). */
export async function studentControls(auth: Auth, now = new Date()): Promise<StudentControls> {
  if (auth.user.role !== "student") throw forbidden("Only students have learning controls.");
  const db = getDb();
  const [settings, today] = await Promise.all([
    controlsOf(auth.user.id, db),
    db.learningDay.findUnique({ where: { studentId_day: { studentId: auth.user.id, day: new Date(`${localDay(now, auth.user.timezone)}T00:00:00Z`) } }, select: { secondsSpent: true } }),
  ]);
  return { ...settings, minutes_today: Math.floor((today?.secondsSpent ?? 0) / 60) };
}
