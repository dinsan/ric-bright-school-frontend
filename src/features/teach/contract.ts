/**
 * The teaching API contract (BE-SCH-03): a teacher's classes and the work they set. Shared by the server
 * (src/server/teaching/service.ts, src/app/api/teach/*) and, later, the teacher screens (FE-TCH-06/07).
 * Paths are relative to /api. Verified teachers only, about their own classes.
 */

export interface TeacherClass {
  id: string;
  name: string;
  code: string;
  students: number;
}

/** POST /teach/classes/{class_id}/assignments: a course, or one of its lessons, by a date. */
export interface AssignmentCreate {
  course_id: string;
  lesson_id?: string | null;
  /** Defaults to the course or lesson title. */
  title?: string;
  instructions?: string | null;
  due_at: string;
}

/** An assignment with each student's progress on it (FE-TCH-07: track completion per student). */
export interface TeacherAssignment {
  id: string;
  title: string;
  instructions: string | null;
  due_at: string;
  course: { id: string; slug: string; title: string };
  lesson: { id: string; slug: string; title: string } | null;
  students: Array<{ id: string; display_name: string; status: "not_started" | "in_progress" | "done"; lessons_done: number; lessons_total: number }>;
  done_count: number;
}

const id = (value: string) => encodeURIComponent(value);

export const teachPaths = {
  classes: "/teach/classes",
  classAssignments: (classId: string) => `/teach/classes/${id(classId)}/assignments`,
  assignment: (assignmentId: string) => `/teach/assignments/${id(assignmentId)}`,
} as const;
