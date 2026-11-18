import "server-only";

import type { Auth } from "@/server/auth/context";
import { toSubject } from "@/server/catalog/service";
import { getDb, type Executor } from "@/server/db";
import { notFound } from "@/server/http/errors";
import type { CourseRecommendation, LearningPathView } from "@/features/learn/contract";
import { buildPath, lockReason, missingPrerequisites, type PathCourse, type PathProgress } from "@/features/learn/path";
import { recommendCourses, type Candidate } from "@/features/learn/recommend";

/**
 * Learning paths (FE-STU-09, BE-CAT-08) and recommended next courses (FE-STU-01), on top of the pure
 * rules in src/features/learn/path.ts and recommend.ts. The catalog is small (tens to hundreds of
 * courses), so the prerequisite graph of published courses is read whole; cache it if it grows large.
 */

const pathSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  gradeLevel: true,
  subject: true,
  prerequisites: { select: { requiresCourseId: true } },
  _count: { select: { enrollments: true, lessons: true } },
} as const;

type PathRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  gradeLevel: number;
  subject: Parameters<typeof toSubject>[0];
  prerequisites: Array<{ requiresCourseId: string }>;
  _count: { enrollments: number; lessons: number };
};

const toPathCourse = (row: PathRow) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  grade_level: row.gradeLevel,
  requires: row.prerequisites.map((prerequisite) => prerequisite.requiresCourseId),
  subject: { slug: row.subject.slug, name: row.subject.name },
  popularity: row._count.enrollments,
  lessons: row._count.lessons,
  row,
});

async function publishedGraph(db: Executor = getDb()) {
  const rows = await db.course.findMany({ where: { status: "published" }, select: pathSelect, orderBy: [{ gradeLevel: "asc" }, { title: "asc" }] });
  const courses = rows.map(toPathCourse);
  return { courses, byId: new Map<string, PathCourse>(courses.map((course) => [course.id, course])) };
}

/** What the student has finished (certificates: kept even after leaving a course) and is taking. */
export async function pathProgress(studentId: string, studentGrade: number | null, db: Executor = getDb()): Promise<PathProgress> {
  const [certificates, enrollments] = await Promise.all([
    db.certificate.findMany({ where: { studentId, courseId: { not: null } }, select: { courseId: true } }),
    db.enrollment.findMany({ where: { studentId }, select: { courseId: true, completedAt: true } }),
  ]);
  const completed = new Set<string>([...certificates.map((row) => row.courseId!), ...enrollments.filter((row) => row.completedAt).map((row) => row.courseId)]);
  const inProgress = new Set(enrollments.filter((row) => !row.completedAt && !completed.has(row.courseId)).map((row) => row.courseId));
  return { completed, inProgress, studentGrade };
}

/** Why this student can't start the course yet, or null (also null for courses without prerequisites). */
export async function courseLockReason(auth: Auth, courseId: string, db: Executor = getDb()): Promise<string | null> {
  const prerequisites = await db.coursePrerequisite.findMany({ where: { courseId }, select: { requires: { select: { id: true, slug: true, title: true, gradeLevel: true, status: true } } } });
  if (prerequisites.length === 0) return null;
  const required: PathCourse[] = prerequisites
    .filter((row) => row.requires.status === "published")
    .map((row) => ({ id: row.requires.id, slug: row.requires.slug, title: row.requires.title, grade_level: row.requires.gradeLevel, requires: [] }));
  const progress = await pathProgress(auth.user.id, auth.user.gradeLevel, db);
  const course: PathCourse = { id: courseId, slug: "", title: "", grade_level: 0, requires: required.map((entry) => entry.id) };
  return lockReason(missingPrerequisites(course, new Map(required.map((entry) => [entry.id, entry])), progress));
}

/**
 * A subject's path for the student: its courses in grade order with status, lock reasons and lessons
 * done. Without a subject: the subject of the course they were last active in, else the first one.
 */
export async function learningPath(auth: Auth, subjectSlug?: string): Promise<LearningPathView> {
  const db = getDb();
  const [{ courses, byId }, progress, lastActive] = await Promise.all([
    publishedGraph(db),
    pathProgress(auth.user.id, auth.user.gradeLevel, db),
    db.enrollment.findFirst({ where: { studentId: auth.user.id }, orderBy: { lastActivityAt: "desc" }, select: { course: { select: { subject: { select: { slug: true } } } } } }),
  ]);
  const subjects = [...new Map(courses.map((course) => [course.row.subject.id, toSubject(course.row.subject)])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const chosen = subjectSlug ?? lastActive?.course.subject.slug ?? subjects[0]?.slug;
  const subject = subjects.find((entry) => entry.slug === chosen);
  if (!subject) throw notFound("That subject");

  const inSubject = courses.filter((course) => course.subject.slug === subject.slug);
  const done = await db.lessonProgress.groupBy({
    by: ["lessonId"],
    where: { studentId: auth.user.id, status: "completed", lesson: { courseId: { in: inSubject.map((course) => course.id) } } },
  });
  const lessonCourse = await db.lesson.findMany({ where: { id: { in: done.map((row) => row.lessonId) } }, select: { courseId: true } });
  const doneByCourse = new Map<string, number>();
  for (const row of lessonCourse) doneByCourse.set(row.courseId, (doneByCourse.get(row.courseId) ?? 0) + 1);

  return {
    subject,
    subjects,
    student_grade: auth.user.gradeLevel,
    steps: buildPath(inSubject, byId, progress).map((step) => ({
      course: { id: step.course.id, slug: step.course.slug, title: step.course.title, summary: step.course.summary, grade_level: step.course.grade_level },
      status: step.status,
      locked_reason: step.locked_reason,
      earlier_grade: step.earlier_grade,
      lessons_done: doneByCourse.get(step.course.id) ?? 0,
      lessons_total: step.course.lessons,
    })),
  };
}

/** A few courses worth starting next, each with its reason. */
export async function recommendations(auth: Auth, limit = 3): Promise<CourseRecommendation[]> {
  const db = getDb();
  const [{ courses, byId }, progress] = await Promise.all([publishedGraph(db), pathProgress(auth.user.id, auth.user.gradeLevel, db)]);
  const enrolled = new Set([...progress.inProgress]);
  const activeSubjects = new Set(courses.filter((course) => progress.inProgress.has(course.id) || progress.completed.has(course.id)).map((course) => course.subject.slug));
  const picked = recommendCourses<Candidate & (typeof courses)[number]>(courses, {
    byId,
    studentGrade: auth.user.gradeLevel,
    enrolled,
    completed: progress.completed,
    activeSubjects,
    limit,
  });
  return picked.map(({ course, reason }) => ({
    course: { id: course.id, slug: course.slug, title: course.title, summary: course.summary, grade_level: course.grade_level, subject: toSubject(course.row.subject) },
    reason,
  }));
}
