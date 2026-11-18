import "server-only";

import { z } from "zod";
import { toSubject } from "@/server/catalog/service";
import type { Auth } from "@/server/auth/context";
import { getDb, type Executor } from "@/server/db";
import { forbidden, HttpError, notFound } from "@/server/http/errors";
import { courseLockReason } from "./paths";
import { reviewDueCount, syncReviewItems } from "./review";
import { randomInt } from "node:crypto";
import { levelForXp, localDay, minutesInLastDays, streaks, summarizeCourse, xpFor } from "@/features/learn/analytics";
import { BADGES, newlyEarnedBadges, type LearningStats } from "@/features/learn/badges";
import { parseBlocks } from "@/features/learn/blocks";
import {
  MAX_SECONDS_PER_REPORT,
  type Badge,
  type Certificate,
  type CourseProgress,
  type Enrollment,
  type LearningSummary,
  type LessonProgressResult,
  type LessonRef,
  type LessonStatus,
  type LessonView,
} from "@/features/learn/contract";

/**
 * Students' learning: enrolments ("My courses"), lesson progress, and the dashboard summary.
 * Everything under /api/learn. A student only ever reads and writes their own data: the student id
 * always comes from the session, never from the request.
 *
 * The numbers (percent, next lesson, streaks, XP) come from src/features/learn/analytics.ts, the
 * same functions the browser uses, so server and browser always agree.
 */

function assertStudent(auth: Auth) {
  if (auth.user.role !== "student") throw forbidden("Only students take courses.");
}

/**
 * Whether this student may start this course. Today every published course is open to every student.
 * Billing (BE-BILL-01, FE-BILL-03) plugs in here: a paid course without an entitlement answers 402
 * with what the plan unlocks. Never block a course already started.
 */
async function assertCanEnroll(_auth: Auth, course: { status: string; priceCents: number }) {
  if (course.status !== "published") throw notFound("That course");
}

const courseSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  gradeLevel: true,
  subject: true,
  lessons: { select: { id: true, slug: true, title: true, position: true }, orderBy: { position: "asc" as const } },
} as const;

type CourseWithLessons = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  gradeLevel: number;
  subject: Parameters<typeof toSubject>[0];
  lessons: LessonRef[];
};

/** The student's status for each of these lessons (lessons without a row are "not_started"). */
async function statusesFor(studentId: string, lessonIds: string[], db: Executor = getDb()): Promise<Map<string, LessonStatus>> {
  if (lessonIds.length === 0) return new Map();
  const rows = await db.lessonProgress.findMany({
    where: { studentId, lessonId: { in: lessonIds } },
    select: { lessonId: true, status: true },
  });
  return new Map(rows.map((row) => [row.lessonId, row.status]));
}

function toEnrollment(
  row: { enrolledAt: Date; completedAt: Date | null; lastActivityAt: Date; lastLessonId: string | null; course: CourseWithLessons },
  status: Map<string, LessonStatus>,
): Enrollment {
  return {
    course: {
      id: row.course.id,
      slug: row.course.slug,
      title: row.course.title,
      summary: row.course.summary,
      grade_level: row.course.gradeLevel,
      subject: toSubject(row.course.subject),
    },
    enrolled_at: row.enrolledAt.toISOString(),
    completed_at: row.completedAt?.toISOString() ?? null,
    last_activity_at: row.lastActivityAt.toISOString(),
    progress: summarizeCourse(row.course.lessons, status, row.lastLessonId),
  };
}

/** "My courses": most recently active first. */
export async function listEnrollments(auth: Auth): Promise<Enrollment[]> {
  assertStudent(auth);
  const rows = await getDb().enrollment.findMany({
    where: { studentId: auth.user.id },
    include: { course: { select: courseSelect } },
    orderBy: [{ lastActivityAt: "desc" }, { enrolledAt: "desc" }],
  });
  const status = await statusesFor(auth.user.id, rows.flatMap((row) => row.course.lessons.map((lesson) => lesson.id)));
  return rows.map((row) => toEnrollment(row, status));
}

export const enrollInput = z.object({ course_id: z.uuid("Choose a course.") });

/** Starts a course. Enrolling twice is fine: the existing enrolment is returned (`created: false`). */
export async function enroll(auth: Auth, { course_id }: z.output<typeof enrollInput>): Promise<{ enrollment: Enrollment; created: boolean }> {
  assertStudent(auth);
  const db = getDb();
  const course = await db.course.findUnique({ where: { id: course_id }, select: { status: true, priceCents: true } });
  if (!course) throw notFound("That course");
  await assertCanEnroll(auth, course);
  // Learning path: a course that builds on one not finished yet waits (never one already started).
  const existing = await db.enrollment.findUnique({ where: { studentId_courseId: { studentId: auth.user.id, courseId: course_id } }, select: { id: true } });
  if (!existing) {
    const locked = await courseLockReason(auth, course_id, db);
    if (locked) throw new HttpError(409, "course_locked", locked);
  }
  // INSERT … ON CONFLICT DO NOTHING: a double click or a retry never makes two enrolments.
  const inserted = await db.enrollment.createMany({ data: [{ studentId: auth.user.id, courseId: course_id }], skipDuplicates: true });
  // Coming back to a course already finished: it stays finished (the certificate says so).
  if (inserted.count > 0) {
    const certificate = await db.certificate.findUnique({ where: { studentId_courseId: { studentId: auth.user.id, courseId: course_id } }, select: { issuedAt: true } });
    if (certificate) await db.enrollment.updateMany({ where: { studentId: auth.user.id, courseId: course_id }, data: { completedAt: certificate.issuedAt } });
  }
  const row = await db.enrollment.findUniqueOrThrow({
    where: { studentId_courseId: { studentId: auth.user.id, courseId: course_id } },
    include: { course: { select: courseSelect } },
  });
  const status = await statusesFor(auth.user.id, row.course.lessons.map((lesson) => lesson.id));
  return { enrollment: toEnrollment(row, status), created: inserted.count > 0 };
}

/** Leaves a course. Lesson progress is kept, so enrolling again picks up where the student was. */
export async function unenroll(auth: Auth, courseId: string): Promise<void> {
  assertStudent(auth);
  const deleted = await getDb().enrollment.deleteMany({ where: { studentId: auth.user.id, courseId } });
  if (deleted.count === 0) throw notFound("That enrolment");
}

/** The course outline with the student's status per lesson. Published courses, or ones they're enrolled in. */
export async function courseProgress(auth: Auth, courseId: string): Promise<CourseProgress> {
  assertStudent(auth);
  const db = getDb();
  const [course, enrollment] = await Promise.all([
    db.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true, lessons: { select: { id: true, slug: true, title: true, position: true, durationMinutes: true }, orderBy: { position: "asc" } } },
    }),
    db.enrollment.findUnique({ where: { studentId_courseId: { studentId: auth.user.id, courseId } }, select: { lastLessonId: true } }),
  ]);
  // An archived course stays visible to students who are taking it; drafts and strangers' archives don't exist.
  if (!course || (course.status !== "published" && !enrollment)) throw notFound("That course");
  const rows = await db.lessonProgress.findMany({
    where: { studentId: auth.user.id, lessonId: { in: course.lessons.map((lesson) => lesson.id) } },
    select: { lessonId: true, status: true, completedAt: true },
  });
  const byLesson = new Map(rows.map((row) => [row.lessonId, row]));
  const status = new Map(rows.map((row) => [row.lessonId, row.status as LessonStatus]));
  return {
    course_id: course.id,
    enrolled: enrollment !== null,
    locked_reason: enrollment ? null : await courseLockReason(auth, course.id, db),
    lessons: course.lessons.map((lesson) => ({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      position: lesson.position,
      duration_minutes: lesson.durationMinutes,
      status: byLesson.get(lesson.id)?.status ?? "not_started",
      completed_at: byLesson.get(lesson.id)?.completedAt?.toISOString() ?? null,
    })),
    summary: summarizeCourse(course.lessons, status, enrollment?.lastLessonId ?? null),
  };
}

const BLOCK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const lessonProgressInput = z.object({
  status: z.enum(["started", "completed"]),
  seconds: z.coerce.number().int().min(0).max(MAX_SECONDS_PER_REPORT).default(0),
  media: z
    .record(z.string().regex(BLOCK_ID), z.number().min(0).max(6 * 60 * 60))
    .refine((value) => Object.keys(value).length <= 20, "Too many media positions in one report.")
    .optional(),
  report_id: z.uuid().optional(),
});

/** The calendar day the database stores for `day` ("YYYY-MM-DD"): a DATE column, read back at UTC midnight. */
const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);

/** Receipts of applied reports are kept this long: far longer than any retry waits. */
const RECEIPT_DAYS = 7;

type MediaPositions = Record<string, number>;
const asPositions = (value: unknown): MediaPositions =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
    : {};

/** Everything the badges and the summary are computed from (courses completed = certificates earned). */
export async function learningStats(db: Executor, studentId: string, timezone: string | null, now: Date) {
  const [lessonsCompleted, coursesCompleted, days, notesWritten] = await Promise.all([
    db.lessonProgress.count({ where: { studentId, status: "completed" } }),
    db.certificate.count({ where: { studentId } }),
    db.learningDay.findMany({ where: { studentId }, select: { day: true, secondsSpent: true } }),
    db.lessonNote.count({ where: { studentId } }),
  ]);
  const today = localDay(now, timezone);
  const activeDays = days.map((row) => ({ day: row.day.toISOString().slice(0, 10), seconds: row.secondsSpent }));
  const streak = streaks(
    activeDays.map((entry) => entry.day),
    today,
  );
  const stats: LearningStats = {
    lessons_completed: lessonsCompleted,
    courses_completed: coursesCompleted,
    streak_days: streak.current,
    minutes_total: Math.floor(activeDays.reduce((sum, entry) => sum + entry.seconds, 0) / 60),
    notes_written: notesWritten,
  };
  return { stats, longestStreak: streak.longest, minutesLast7Days: minutesInLastDays(activeDays, today) };
}

/** Awards the badges these stats earn that the student doesn't have yet; returns the new ones (for the celebration). */
export async function awardBadges(db: Executor, studentId: string, stats: LearningStats, now: Date): Promise<Badge[]> {
  const owned = await db.studentBadge.findMany({ where: { studentId }, select: { badge: true } });
  const earned = newlyEarnedBadges(
    stats,
    owned.map((row) => row.badge),
  );
  if (earned.length) await db.studentBadge.createMany({ data: earned.map((badge) => ({ studentId, badge: badge.id, earnedAt: now })), skipDuplicates: true });
  return earned.map((badge) => toBadge(badge, now));
}

const xpOf = (stats: LearningStats) => xpFor({ lessonsCompleted: stats.lessons_completed, coursesCompleted: stats.courses_completed });

function toBadge(definition: (typeof BADGES)[number], earnedAt: Date | null): Badge {
  return { id: definition.id, name: definition.name, description: definition.description, icon: definition.icon, earned_at: earnedAt?.toISOString() ?? null };
}

type CertificateRow = {
  id: string;
  code: string;
  studentName: string;
  courseTitle: string;
  subjectName: string;
  gradeLevel: number;
  lessonsCount: number;
  issuedAt: Date;
  course: { slug: string; status: string } | null;
};

function toCertificate(row: CertificateRow): Certificate {
  return {
    id: row.id,
    code: row.code,
    student_name: row.studentName,
    course_title: row.courseTitle,
    subject_name: row.subjectName,
    grade_level: row.gradeLevel,
    lessons_count: row.lessonsCount,
    issued_at: row.issuedAt.toISOString(),
    course_slug: row.course?.status === "published" ? row.course.slug : null,
  };
}

const certificateInclude = { course: { select: { slug: true, status: true } } } as const;

/** "LUM-7K2Q-9XHD": 8 random characters without look-alikes (0/O, 1/I/L), easy to read out. */
export function certificateCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const pick = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `LUM-${pick()}-${pick()}`;
}

/** Issues the certificate for a finished course (once; a code collision just tries another code). */
async function issueCertificate(tx: Executor, auth: Auth, courseId: string, now: Date): Promise<Certificate | null> {
  const course = await tx.course.findUnique({ where: { id: courseId }, include: { subject: true, _count: { select: { lessons: true } } } });
  if (!course) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const created = await tx.certificate.createMany({
      data: [
        {
          studentId: auth.user.id,
          courseId,
          code: certificateCode(),
          studentName: auth.user.displayName,
          courseTitle: course.title,
          subjectName: course.subject.name,
          gradeLevel: course.gradeLevel,
          lessonsCount: course._count.lessons,
          issuedAt: now,
        },
      ],
      skipDuplicates: true,
    });
    const row = await tx.certificate.findUnique({ where: { studentId_courseId: { studentId: auth.user.id, courseId } }, include: certificateInclude });
    if (row) return created.count > 0 ? toCertificate(row) : null; // null: it already existed, nothing new to celebrate
  }
  throw new Error("Could not find a free certificate code.");
}

/**
 * Records a progress report from the lesson player (or the offline queue).
 * - Idempotent: "completed" never goes back to "started", a lesson is counted once, and a report whose
 *   `report_id` was already applied changes nothing (a retry after a lost answer, FE-STU-05).
 * - Serialized per student and course (row lock on the enrolment), so reports arriving together are
 *   applied one after another.
 * - Updates the enrolment ("Continue"), the video positions, today's learning day, badges, and finishing
 *   the last lesson completes the course and issues its certificate. The result says what was earned,
 *   for the celebration (FE-STU-07).
 */
export async function recordLessonProgress(auth: Auth, lessonId: string, input: z.output<typeof lessonProgressInput>, now = new Date()): Promise<LessonProgressResult> {
  assertStudent(auth);
  const db = getDb();
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true, course: { select: { status: true } } } });
  if (!lesson) throw notFound("That lesson");
  const enrollment = await db.enrollment.findUnique({
    where: { studentId_courseId: { studentId: auth.user.id, courseId: lesson.courseId } },
    select: { id: true },
  });
  if (!enrollment) {
    if (lesson.course.status !== "published") throw notFound("That lesson");
    throw new HttpError(409, "not_enrolled", "Start the course first, then its lessons.");
  }

  const result = await db.$transaction(async (tx) => {
    // One report at a time per student and course: lock the enrolment row first. Without it, two
    // reports arriving together (a retry queue, two tabs) both read "not completed yet", count the
    // lesson twice, and can both miss that the course is now finished. Later reads in this
    // transaction see what the previous report committed (READ COMMITTED).
    const locked = await tx.$queryRaw<Array<{ completed_at: Date | null }>>`select completed_at from enrollments where id = ${enrollment.id}::uuid for update`;
    if (locked.length === 0) throw new HttpError(409, "not_enrolled", "Start the course first, then its lessons.");
    const courseAlreadyCompleted = locked[0]!.completed_at !== null;

    const previous = await tx.lessonProgress.findUnique({ where: { studentId_lessonId: { studentId: auth.user.id, lessonId } } });

    // Already applied (a retry): answer with the current state, change nothing.
    if (input.report_id) {
      const receipt = await tx.progressReceipt.createMany({ data: [{ studentId: auth.user.id, reportId: input.report_id, receivedAt: now }], skipDuplicates: true });
      if (receipt.count === 0) {
        const { stats } = await learningStats(tx, auth.user.id, auth.user.timezone, now);
        const level = levelForXp(xpOf(stats)).level;
        return {
          lesson_id: lessonId,
          status: previous?.status ?? "started",
          seconds_spent: previous?.secondsSpent ?? 0,
          completed_at: previous?.completedAt?.toISOString() ?? null,
          media_positions: asPositions(previous?.mediaPositions),
          course_completed: false,
          duplicate: true,
          new_badges: [],
          level: { before: level, after: level },
          certificate: null,
        } satisfies LessonProgressResult;
      }
    }

    const before = await learningStats(tx, auth.user.id, auth.user.timezone, now);
    const newlyCompleted = input.status === "completed" && previous?.status !== "completed";
    const media = { ...asPositions(previous?.mediaPositions), ...(input.media ?? {}) };
    const progress = await tx.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId: auth.user.id, lessonId } },
      create: {
        studentId: auth.user.id,
        lessonId,
        status: input.status,
        secondsSpent: input.seconds,
        startedAt: now,
        completedAt: input.status === "completed" ? now : null,
        mediaPositions: media,
      },
      update: {
        secondsSpent: { increment: input.seconds },
        ...(input.media ? { mediaPositions: media } : {}),
        ...(newlyCompleted ? { status: "completed" as const, completedAt: now } : {}),
      },
    });

    // Today's learning, in the student's own time zone (streaks, minutes).
    if (input.seconds > 0 || newlyCompleted || !previous) {
      const day = dateOf(localDay(now, auth.user.timezone));
      await tx.learningDay.upsert({
        where: { studentId_day: { studentId: auth.user.id, day } },
        create: { studentId: auth.user.id, day, secondsSpent: input.seconds, lessonsCompleted: newlyCompleted ? 1 : 0 },
        update: { secondsSpent: { increment: input.seconds }, ...(newlyCompleted ? { lessonsCompleted: { increment: 1 } } : {}) },
      });
    }

    // The course is finished when none of its lessons is left unfinished: completed, with a certificate.
    let courseCompleted = false;
    let certificate: Certificate | null = null;
    if (newlyCompleted && !courseAlreadyCompleted) {
      const remaining = await tx.lesson.count({
        where: { courseId: lesson.courseId, NOT: { progress: { some: { studentId: auth.user.id, status: "completed" } } } },
      });
      courseCompleted = remaining === 0;
      if (courseCompleted) certificate = await issueCertificate(tx, auth, lesson.courseId, now);
    }
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { lastLessonId: lessonId, lastActivityAt: now, ...(courseCompleted ? { completedAt: now } : {}) },
    });

    // The lesson's quick checks join the review queue (first review tomorrow).
    if (newlyCompleted) await syncReviewItems(tx, auth.user.id, [lessonId]);

    // Badges and level: compared with before this report, for the celebration.
    const after = await learningStats(tx, auth.user.id, auth.user.timezone, now);
    const earned = await awardBadges(tx, auth.user.id, after.stats, now);

    return {
      lesson_id: lessonId,
      status: progress.status,
      seconds_spent: progress.secondsSpent,
      completed_at: progress.completedAt?.toISOString() ?? null,
      media_positions: asPositions(progress.mediaPositions),
      course_completed: courseCompleted,
      duplicate: false,
      new_badges: earned,
      level: { before: levelForXp(xpOf(before.stats)).level, after: levelForXp(xpOf(after.stats)).level },
      certificate,
    } satisfies LessonProgressResult;
  });

  // Housekeeping, now and then: receipts older than any retry.
  if (input.report_id && Math.random() < 0.02) {
    await db.progressReceipt.deleteMany({ where: { receivedAt: { lt: new Date(now.getTime() - RECEIPT_DAYS * 86_400_000) } } }).catch(() => {});
  }
  return result;
}

/** The student dashboard's numbers (FE-STU-01), computed with the shared analytics functions. */
export async function learningSummary(auth: Auth, now = new Date()): Promise<LearningSummary> {
  assertStudent(auth);
  const db = getDb();
  await syncReviewItems(db, auth.user.id);
  const [enrollments, { stats, longestStreak, minutesLast7Days }, badgesEarned, reviewDue, bookmarksCount] = await Promise.all([
    db.enrollment.findMany({
      where: { studentId: auth.user.id },
      include: { course: { select: courseSelect } },
      orderBy: [{ lastActivityAt: "desc" }, { enrolledAt: "desc" }],
    }),
    learningStats(db, auth.user.id, auth.user.timezone, now),
    db.studentBadge.count({ where: { studentId: auth.user.id, badge: { in: BADGES.map((badge) => badge.id) } } }),
    reviewDueCount(auth.user.id, now, db),
    db.lessonBookmark.count({ where: { studentId: auth.user.id } }),
  ]);
  const status = await statusesFor(auth.user.id, enrollments.flatMap((row) => row.course.lessons.map((lesson) => lesson.id)));
  const mine = enrollments.map((row) => toEnrollment(row, status));
  const xp = xpOf(stats);
  const resume = mine.find((entry) => !entry.completed_at && entry.progress.next_lesson);
  return {
    streak_days: stats.streak_days,
    longest_streak_days: longestStreak,
    xp,
    level: levelForXp(xp),
    lessons_completed: stats.lessons_completed,
    courses_completed: stats.courses_completed,
    minutes_last_7_days: minutesLast7Days,
    continue_learning: resume ? { course: resume.course, lesson: resume.progress.next_lesson! } : null,
    minutes_total: stats.minutes_total,
    badges_earned: badgesEarned,
    certificates: stats.courses_completed,
    review_due: reviewDue,
    notes_count: stats.notes_written,
    bookmarks_count: bookmarksCount,
  };
}

// --- The lesson player ------------------------------------------------------------------------------

/** A lesson's id from its course and lesson slugs (the player's URL), or null. */
export async function findLessonId(courseSlug: string, lessonSlug: string): Promise<string | null> {
  if (courseSlug.length > 120 || lessonSlug.length > 120) return null;
  const row = await getDb().lesson.findFirst({ where: { slug: lessonSlug, course: { slug: courseSlug } }, select: { id: true } });
  return row?.id ?? null;
}

/**
 * Everything the lesson player shows: the lesson, its content (only once the course is started), the
 * outline with the student's status per lesson, previous / next, and where each video was left.
 * Published courses, or ones the student is taking.
 */
export async function lessonView(auth: Auth, lessonId: string): Promise<LessonView> {
  assertStudent(auth);
  const db = getDb();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        include: {
          subject: true,
          lessons: { select: { id: true, slug: true, title: true, position: true, durationMinutes: true }, orderBy: { position: "asc" } },
        },
      },
    },
  });
  if (!lesson) throw notFound("That lesson");
  const enrollment = await db.enrollment.findUnique({ where: { studentId_courseId: { studentId: auth.user.id, courseId: lesson.courseId } }, select: { id: true } });
  if (lesson.course.status !== "published" && !enrollment) throw notFound("That lesson");

  const rows = await db.lessonProgress.findMany({
    where: { studentId: auth.user.id, lessonId: { in: lesson.course.lessons.map((entry) => entry.id) } },
    select: { lessonId: true, status: true, completedAt: true, secondsSpent: true, mediaPositions: true },
  });
  const byLesson = new Map(rows.map((row) => [row.lessonId, row]));
  const index = lesson.course.lessons.findIndex((entry) => entry.id === lesson.id);
  const ref = (at: number): LessonRef | null => {
    const entry = lesson.course.lessons[at];
    return entry ? { id: entry.id, slug: entry.slug, title: entry.title, position: entry.position } : null;
  };
  const { blocks, dropped } = parseBlocks(lesson.content);
  if (dropped > 0) console.warn(`[learning] lesson ${lesson.id}: ${dropped} invalid content block(s) left out`);
  const own = byLesson.get(lesson.id);
  return {
    course: { id: lesson.course.id, slug: lesson.course.slug, title: lesson.course.title, grade_level: lesson.course.gradeLevel, subject: toSubject(lesson.course.subject) },
    lesson: { id: lesson.id, slug: lesson.slug, title: lesson.title, summary: lesson.summary, position: lesson.position, duration_minutes: lesson.durationMinutes },
    blocks: enrollment ? blocks : [],
    enrolled: enrollment !== null,
    locked_reason: enrollment ? null : await courseLockReason(auth, lesson.courseId, db),
    outline: lesson.course.lessons.map((entry) => ({
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      position: entry.position,
      duration_minutes: entry.durationMinutes,
      status: byLesson.get(entry.id)?.status ?? "not_started",
      completed_at: byLesson.get(entry.id)?.completedAt?.toISOString() ?? null,
    })),
    progress: { status: own?.status ?? "not_started", seconds_spent: own?.secondsSpent ?? 0, media_positions: asPositions(own?.mediaPositions) },
    previous: ref(index - 1),
    next: ref(index + 1),
  };
}

// --- Badges and certificates -------------------------------------------------------------------------

/** The whole badge shelf, earned ones with their date (FE-STU-07). */
export async function listBadges(auth: Auth): Promise<Badge[]> {
  assertStudent(auth);
  const rows = await getDb().studentBadge.findMany({ where: { studentId: auth.user.id } });
  const earned = new Map(rows.map((row) => [row.badge, row.earnedAt]));
  return BADGES.map((definition) => toBadge(definition, earned.get(definition.id) ?? null));
}

/** Certificates earned, newest first (FE-STU-08). */
export async function listCertificates(auth: Auth): Promise<Certificate[]> {
  assertStudent(auth);
  const rows = await getDb().certificate.findMany({ where: { studentId: auth.user.id }, include: certificateInclude, orderBy: { issuedAt: "desc" } });
  return rows.map(toCertificate);
}

/** One of the student's certificates; anyone else's is "not found" (never "forbidden"). */
export async function getCertificate(auth: Auth, certificateId: string): Promise<Certificate> {
  assertStudent(auth);
  const row = await getDb().certificate.findFirst({ where: { id: certificateId, studentId: auth.user.id }, include: certificateInclude });
  if (!row) throw notFound("That certificate");
  return toCertificate(row);
}

