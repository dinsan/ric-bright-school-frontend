import "server-only";

import type { Auth } from "@/server/auth/context";
import { getDb } from "@/server/db";
import { assignmentStatus } from "@/features/learn/assignments";
import type { StudentAssignment } from "@/features/learn/contract";

/**
 * Assigned work from the student's side (FE-STU-01): everything the teachers of the student's classes
 * set, with how far along the student is, computed from their lesson progress. Not yet done first,
 * soonest due first; done at the end.
 */
export async function studentAssignments(auth: Auth): Promise<StudentAssignment[]> {
  return assignmentsOf(auth.user.id);
}

/** The same list for any student: the parent's view of a child (src/server/family/progress.ts) uses it. */
export async function assignmentsOf(studentId: string): Promise<StudentAssignment[]> {
  const db = getDb();
  const rows = await db.assignment.findMany({
    where: { class: { members: { some: { studentId } } }, course: { status: "published" } },
    include: {
      class: { select: { name: true, teacher: { select: { displayName: true } } } },
      course: { select: { id: true, slug: true, title: true, lessons: { select: { id: true }, orderBy: { position: "asc" } } } },
      lesson: { select: { id: true, slug: true, title: true, position: true } },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });
  const lessonIds = [...new Set(rows.flatMap((row) => (row.lesson ? [row.lesson.id] : row.course.lessons.map((lesson) => lesson.id))))];
  const progress = await db.lessonProgress.findMany({ where: { studentId, lessonId: { in: lessonIds } }, select: { lessonId: true, status: true } });
  const status = new Map(progress.map((row) => [row.lessonId, row.status]));

  const list = rows.map((row): StudentAssignment => {
    const targets = row.lesson ? [row.lesson.id] : row.course.lessons.map((lesson) => lesson.id);
    const done = targets.filter((id) => status.get(id) === "completed").length;
    const started = targets.some((id) => status.has(id));
    return {
      id: row.id,
      title: row.title,
      instructions: row.instructions,
      due_at: row.dueAt.toISOString(),
      class_name: row.class.name,
      teacher_name: row.class.teacher.displayName,
      course: { id: row.course.id, slug: row.course.slug, title: row.course.title },
      lesson: row.lesson,
      status: assignmentStatus(done, targets.length, started),
      lessons_done: done,
      lessons_total: targets.length,
      href: row.lesson ? `/learn/courses/${row.course.slug}/lessons/${row.lesson.slug}` : `/learn/courses/${row.course.slug}`,
    };
  });
  return [...list.filter((entry) => entry.status !== "done"), ...list.filter((entry) => entry.status === "done")];
}
