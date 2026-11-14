import "server-only";

import { z } from "zod";
import { USERNAME_PATTERN, type Child, type ChildDataExport } from "@/features/auth/contract";
import { MAX_GRADE, MIN_GRADE } from "@/features/catalog/constants";
import { fields } from "@/lib/forms/zod";
import { messages } from "@/lib/forms/messages";
import { toChild } from "@/server/accounts/serializers";
import { audit } from "@/server/audit";
import type { Auth } from "@/server/auth/context";
import { hashPassword, pictureSecret } from "@/server/auth/password";
import { password, pictureSet } from "@/server/auth/service";
import { deleteUserSessions } from "@/server/auth/session";
import { consumeToken } from "@/server/auth/tokens";
import { getDb, isUniqueViolation } from "@/server/db";
import { fieldError, forbidden, HttpError, notFound } from "@/server/http/errors";
import { enforceRateLimit } from "@/server/http/rate-limit";

/** Parents and their children's accounts: everything under /api/me/children and /api/me/active-child. */

function assertParent(auth: Auth) {
  if (auth.user.role !== "parent") throw forbidden("Only parents and guardians manage children's accounts.");
}

/** The child, if it is one of this parent's children. */
async function ownChild(parentId: string, childId: string) {
  const row = await getDb().guardianship.findUnique({
    where: { parentId_childId: { parentId, childId } },
    include: { child: true },
  });
  return row?.child ?? null;
}

export async function listChildren(auth: Auth): Promise<Child[]> {
  assertParent(auth);
  const rows = await getDb().guardianship.findMany({
    where: { parentId: auth.user.id },
    include: { child: true },
    orderBy: [{ createdAt: "asc" }, { child: { displayName: "asc" } }],
  });
  return rows.map((row) => toChild(row.child));
}

export const childCreateInput = z.object({
  display_name: fields.text("your child's name", { max: 80 }),
  grade_level: z.coerce.number().int().min(MIN_GRADE).max(MAX_GRADE),
  parental_consent: z.literal(true, { error: messages.accept("confirm you are their parent or guardian") }),
});

/** Makes a student account for a child; the parent's confirmation is recorded as consent. */
export async function addChild(auth: Auth, input: z.output<typeof childCreateInput>): Promise<Child> {
  assertParent(auth);
  await enforceRateLimit(`add-child:${auth.user.id}`, 20, 24 * 60 * 60);
  const child = await getDb().$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        role: "student",
        displayName: input.display_name,
        gradeLevel: input.grade_level,
        createdById: auth.user.id,
        language: auth.user.language ?? "en",
        timezone: auth.user.timezone,
      },
    });
    await tx.guardianship.create({ data: { parentId: auth.user.id, childId: created.id, consentAt: new Date() } });
    // The first child becomes the one the app shows.
    if (!auth.user.activeChildId) await tx.user.update({ where: { id: auth.user.id }, data: { activeChildId: created.id } });
    return created;
  });
  return toChild(child);
}

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: messages.required("a username"), abort: true })
  .regex(USERNAME_PATTERN, "Use 3 to 30 letters or numbers (dots, dashes and underscores are fine too).");

export const signInSetupInput = z.discriminatedUnion(
  "method",
  [
    z.object({ method: z.literal("password"), username, password }),
    z.object({ method: z.literal("pictures"), username, pictures: pictureSet }),
  ],
  { error: messages.choose("how your child signs in") },
);

/**
 * Sets how a child signs in: a username with a password, or a username with 3 pictures (classroom
 * devices). One method at a time; changing it signs the child out of their devices.
 */
export async function setUpChildSignIn(auth: Auth, childId: string, input: z.output<typeof signInSetupInput>): Promise<Child> {
  assertParent(auth);
  const child = await ownChild(auth.user.id, childId);
  if (!child) throw notFound("That child");
  const secrets =
    input.method === "password"
      ? { passwordHash: await hashPassword(input.password), pictureHash: null }
      : { passwordHash: null, pictureHash: await hashPassword(pictureSecret(input.pictures)) };
  try {
    const updated = await getDb().user.update({
      where: { id: child.id },
      data: { username: input.username, ...secrets, failedSignIns: 0, lockedUntil: null },
    });
    await deleteUserSessions(child.id);
    return toChild(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw fieldError("username", "This username is taken. Try adding a number, like maya7.", { status: 409, code: "username_taken" });
    }
    throw error;
  }
}

/**
 * Deletes a child's account (FE-PUB-11): the account, its sessions, sign-in methods, family and class
 * connections go with it (ON DELETE CASCADE). Any guardian may do it — each confirmed they are the
 * child's parent or legal guardian. The security log keeps only that a child account was deleted, never
 * the child's name (children's data stays out of logs).
 */
export async function deleteChild(auth: Auth, childId: string, request: Request): Promise<void> {
  assertParent(auth);
  if (auth.session.kind === "impersonation") throw forbidden("Support can't delete accounts while viewing as a parent.");
  const child = await ownChild(auth.user.id, childId);
  if (!child) throw notFound("That child");
  const db = getDb();
  await db.$transaction(async (tx) => {
    const guardians = await tx.guardianship.count({ where: { childId: child.id } });
    await audit(
      request,
      { actorId: auth.user.id, action: "family.child_deleted", data: { child_id: child.id, guardians } },
      tx,
    );
    await tx.user.delete({ where: { id: child.id } });
  });
}

/** A copy of everything Lumina stores about the child, for the parent to keep (FE-PUB-11). */
export async function childDataCopy(auth: Auth, childId: string): Promise<ChildDataExport> {
  assertParent(auth);
  const child = await ownChild(auth.user.id, childId);
  if (!child) throw notFound("That child");
  const db = getDb();
  const [guardianships, memberships, enrollments, lessons, days, badges, certificates, reviewItems, notes, bookmarks] = await Promise.all([
    db.guardianship.findMany({ where: { childId: child.id }, include: { parent: true }, orderBy: { createdAt: "asc" } }),
    db.classMember.findMany({ where: { studentId: child.id }, include: { class: true }, orderBy: { joinedAt: "asc" } }),
    db.enrollment.findMany({ where: { studentId: child.id }, include: { course: { select: { title: true } } }, orderBy: { enrolledAt: "asc" } }),
    db.lessonProgress.findMany({
      where: { studentId: child.id },
      include: { lesson: { select: { title: true, course: { select: { title: true } } } } },
      orderBy: { startedAt: "asc" },
    }),
    db.learningDay.findMany({ where: { studentId: child.id }, orderBy: { day: "asc" } }),
    db.studentBadge.findMany({ where: { studentId: child.id }, orderBy: { earnedAt: "asc" } }),
    db.certificate.findMany({ where: { studentId: child.id }, orderBy: { issuedAt: "asc" } }),
    db.reviewItem.findMany({ where: { studentId: child.id }, include: { lesson: { select: { title: true, course: { select: { title: true } } } } }, orderBy: { dueAt: "asc" } }),
    db.lessonNote.findMany({ where: { studentId: child.id }, include: { lesson: { select: { title: true, course: { select: { title: true } } } } }, orderBy: { createdAt: "asc" } }),
    db.lessonBookmark.findMany({ where: { studentId: child.id }, include: { lesson: { select: { title: true, course: { select: { title: true } } } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const serialized = toChild(child);
  return {
    exported_at: new Date().toISOString(),
    child: {
      id: child.id,
      display_name: child.displayName,
      grade_level: child.gradeLevel,
      username: child.username,
      sign_in_method: serialized.sign_in_method,
      language: child.language,
      timezone: child.timezone,
      created_at: child.createdAt.toISOString(),
      last_login_at: child.lastLoginAt?.toISOString() ?? null,
    },
    guardians: guardianships.map((row) => ({
      display_name: row.parent.displayName,
      linked_at: row.createdAt.toISOString(),
      consent_at: row.consentAt?.toISOString() ?? null,
    })),
    classes: memberships.map((row) => ({ name: row.class.name, joined_at: row.joinedAt.toISOString() })),
    learning: {
      courses: enrollments.map((row) => ({ course: row.course.title, enrolled_at: row.enrolledAt.toISOString(), completed_at: row.completedAt?.toISOString() ?? null })),
      lessons: lessons.map((row) => ({
        course: row.lesson.course.title,
        lesson: row.lesson.title,
        status: row.status,
        seconds_spent: row.secondsSpent,
        started_at: row.startedAt.toISOString(),
        completed_at: row.completedAt?.toISOString() ?? null,
        video_positions: (row.mediaPositions ?? {}) as Record<string, number>,
      })),
      badges: badges.map((row) => ({ badge: row.badge, earned_at: row.earnedAt.toISOString() })),
      notes: notes.map((row) => ({
        course: row.lesson.course.title,
        lesson: row.lesson.title,
        about: row.blockId,
        text: row.body,
        written_at: row.createdAt.toISOString(),
        changed_at: row.updatedAt.toISOString(),
      })),
      bookmarks: bookmarks.map((row) => ({
        course: row.lesson.course.title,
        lesson: row.lesson.title,
        about: row.blockId,
        video_seconds: row.mediaSeconds,
        created_at: row.createdAt.toISOString(),
      })),
      review: reviewItems.map((row) => ({
        course: row.lesson.course.title,
        lesson: row.lesson.title,
        question: row.blockId,
        box: row.box,
        reviews: row.reps,
        misses: row.lapses,
        due_at: row.dueAt.toISOString(),
      })),
      certificates: certificates.map((row) => ({ code: row.code, course: row.courseTitle, student_name: row.studentName, issued_at: row.issuedAt.toISOString() })),
      days: days.map((row) => ({ day: row.day.toISOString().slice(0, 10), seconds_spent: row.secondsSpent, lessons_completed: row.lessonsCompleted })),
    },
    notes:
      "This is everything Lumina stores about this child: their account, how they sign in (passwords and picture codes are stored only as one-way hashes and can't be included), their parents or guardians, their school classes, and their learning (courses, lessons, video positions, learning time per day, review schedule, notes and bookmarks, badges and certificates).",
  };
}

export const linkChildInput = z.object({ code: z.string().trim().min(1, messages.required("the code")).max(20) });

/** Links an existing student account with the one-time code the student made (Account, then Connect a parent). */
export async function linkChild(auth: Auth, { code }: z.output<typeof linkChildInput>): Promise<Child> {
  assertParent(auth);
  await enforceRateLimit(`link-child:${auth.user.id}`, 10, 15 * 60);
  const normalised = code.replace(/[\s-]+/g, "").toUpperCase();
  const token = await consumeToken("parent_link", normalised);
  if (!token?.userId) throw fieldError("code", "This code doesn't work. Ask your child to make a new one.", { code: "invalid_code" });
  const db = getDb();
  const child = await db.user.findUnique({ where: { id: token.userId } });
  if (!child || child.role !== "student") throw fieldError("code", "This code doesn't work. Ask your child to make a new one.", { code: "invalid_code" });
  // INSERT … ON CONFLICT DO NOTHING: an existing link is reported, not duplicated.
  const inserted = await db.guardianship.createMany({ data: [{ parentId: auth.user.id, childId: child.id }], skipDuplicates: true });
  if (inserted.count === 0) throw new HttpError(409, "already_linked", `${child.displayName} is already linked to your account.`);
  if (!auth.user.activeChildId) await db.user.update({ where: { id: auth.user.id }, data: { activeChildId: child.id } });
  return toChild(child);
}

export const activeChildInput = z.object({ child_id: z.uuid() });

export async function setActiveChild(auth: Auth, { child_id }: z.output<typeof activeChildInput>) {
  assertParent(auth);
  if (!(await ownChild(auth.user.id, child_id))) throw notFound("That child");
  await getDb().user.update({ where: { id: auth.user.id }, data: { activeChildId: child_id } });
}
