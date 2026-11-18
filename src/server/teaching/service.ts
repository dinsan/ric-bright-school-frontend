import "server-only";

import { z } from "zod";
import type { Auth } from "@/server/auth/context";
import { getDb } from "@/server/db";
import { fieldError, forbidden, notFound } from "@/server/http/errors";
import { assignmentStatus } from "@/features/learn/assignments";
import type { TeacherAssignment, TeacherClass } from "@/features/teach/contract";

/**
 * Teaching (BE-SCH-03): a teacher's classes and the work they set them (everything under /api/teach).
 * Only verified teachers (an admin checked them: the safety page promises it), only their own classes.
 * The teacher screens come with FE-TCH-06/07; the student side reads assignments through /api/learn.
 */

async function verifiedTeacher(auth: Auth) {
  if (auth.user.role !== "teacher") throw forbidden("Only teachers set work.");
  const profile = await getDb().teacherProfile.findUnique({ where: { userId: auth.user.id }, select: { verifiedAt: true } });
  if (!profile?.verifiedAt) throw forbidden("Your teacher account isn't verified yet. An admin checks every teacher before they can work with a class.");
}

async function ownClass(auth: Auth, classId: string) {
  const row = await getDb().class.findFirst({ where: { id: classId, teacherId: auth.user.id }, include: { members: { include: { student: { select: { id: true, displayName: true } } } } } });
  if (!row) throw notFound("That class");
  return row;
}

export async function listClasses(auth: Auth): Promise<TeacherClass[]> {
  await verifiedTeacher(auth);
  const rows = await getDb().class.findMany({ where: { teacherId: auth.user.id }, include: { _count: { select: { members: true } } }, orderBy: { name: "asc" } });
  return rows.map((row) => ({ id: row.id, name: row.name, code: row.code, students: row._count.members }));
}

/** A class's assignments with each student's progress (FE-TCH-07: track completion per student). */
export async function listClassAssignments(auth: Auth, classId: string): Promise<TeacherAssignment[]> {
  await verifiedTeacher(auth);
  const klass = await ownClass(auth, classId);
  const db = getDb();
  const rows = await db.assignment.findMany({
    where: { classId },
    include: { course: { select: { id: true, slug: true, title: true, lessons: { select: { id: true } } } }, lesson: { select: { id: true, slug: true, title: true } } },
    orderBy: { dueAt: "asc" },
  });
  const students = klass.members.map((member) => member.student).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const lessonIds = [...new Set(rows.flatMap((row) => (row.lesson ? [row.lesson.id] : row.course.lessons.map((lesson) => lesson.id))))];
  const progress = await db.lessonProgress.findMany({
    where: { studentId: { in: students.map((student) => student.id) }, lessonId: { in: lessonIds } },
    select: { studentId: true, lessonId: true, status: true },
  });
  const key = (studentId: string, lessonId: string) => `${studentId}:${lessonId}`;
  const status = new Map(progress.map((row) => [key(row.studentId, row.lessonId), row.status]));
  return rows.map((row) => {
    const targets = row.lesson ? [row.lesson.id] : row.course.lessons.map((lesson) => lesson.id);
    const perStudent = students.map((student) => {
      const done = targets.filter((id) => status.get(key(student.id, id)) === "completed").length;
      const started = targets.some((id) => status.has(key(student.id, id)));
      return { id: student.id, display_name: student.displayName, status: assignmentStatus(done, targets.length, started), lessons_done: done, lessons_total: targets.length };
    });
    return {
      id: row.id,
      title: row.title,
      instructions: row.instructions,
      due_at: row.dueAt.toISOString(),
      course: { id: row.course.id, slug: row.course.slug, title: row.course.title },
      lesson: row.lesson,
      students: perStudent,
      done_count: perStudent.filter((student) => student.status === "done").length,
    };
  });
}

export const assignmentCreateInput = z.object({
  course_id: z.uuid("Choose a course."),
  lesson_id: z.uuid().nullish(),
  title: z.string().trim().min(1).max(160).optional(),
  instructions: z.string().trim().max(1000).nullish(),
  due_at: z.iso.datetime({ offset: true, error: "Choose a due date." }),
});

/** Sets work for a class: a published course, or one of its lessons, due at a date that hasn't passed. */
export async function createAssignment(auth: Auth, classId: string, input: z.output<typeof assignmentCreateInput>, now = new Date()): Promise<TeacherAssignment> {
  await verifiedTeacher(auth);
  await ownClass(auth, classId);
  const db = getDb();
  const course = await db.course.findFirst({ where: { id: input.course_id, status: "published" }, select: { id: true, title: true } });
  if (!course) throw fieldError("course_id", "Choose a published course.");
  let lessonTitle: string | null = null;
  if (input.lesson_id) {
    const lesson = await db.lesson.findFirst({ where: { id: input.lesson_id, courseId: course.id }, select: { title: true } });
    if (!lesson) throw fieldError("lesson_id", "Choose a lesson of this course.");
    lessonTitle = lesson.title;
  }
  const dueAt = new Date(input.due_at);
  if (dueAt.getTime() < now.getTime() - 60_000) throw fieldError("due_at", "Choose a due date that hasn't passed.");
  const created = await db.assignment.create({
    data: {
      classId,
      teacherId: auth.user.id,
      courseId: course.id,
      lessonId: input.lesson_id ?? null,
      title: input.title ?? lessonTitle ?? course.title,
      instructions: input.instructions ?? null,
      dueAt,
    },
  });
  return (await listClassAssignments(auth, classId)).find((entry) => entry.id === created.id)!;
}

export async function deleteAssignment(auth: Auth, assignmentId: string): Promise<void> {
  await verifiedTeacher(auth);
  const deleted = await getDb().assignment.deleteMany({ where: { id: assignmentId, class: { teacherId: auth.user.id } } });
  if (deleted.count === 0) throw notFound("That assignment");
}
