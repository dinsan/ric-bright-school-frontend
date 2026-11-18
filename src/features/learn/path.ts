/**
 * Learning paths (FE-STU-09, BE-CAT-08): a subject's courses in grade order, and for each one what it
 * is for this student: done, in progress, next, available or locked, and why.
 *
 * The lock rule, so it can be explained in one sentence: a course is locked while one of its
 * prerequisites is unfinished **and at or above the student's own grade**. Prerequisites below the
 * student's grade count as known from school, so a Grade 9 student joining today isn't sent back to
 * Grade 7. Without a grade, every unfinished prerequisite locks. Pure: used by the server (to refuse
 * enrolling in a locked course) and by the browser (to show the path).
 */

export interface PathCourse {
  id: string;
  slug: string;
  title: string;
  grade_level: number;
  /** Ids of the courses it builds on. */
  requires: string[];
}

export type PathStatus = "done" | "in_progress" | "next" | "available" | "locked";

export interface PathProgress {
  completed: ReadonlySet<string>;
  inProgress: ReadonlySet<string>;
  studentGrade: number | null;
}

/** The unfinished prerequisites that lock `course` for this student (empty: not locked). */
export function missingPrerequisites(course: PathCourse, byId: ReadonlyMap<string, PathCourse>, progress: PathProgress): PathCourse[] {
  return course.requires
    .map((id) => byId.get(id))
    .filter((required): required is PathCourse => Boolean(required))
    .filter((required) => !progress.completed.has(required.id) && (progress.studentGrade === null || required.grade_level >= progress.studentGrade));
}

/** "Finish Ratios and Rates (Grade 6) first." */
export function lockReason(missing: readonly PathCourse[]): string | null {
  if (missing.length === 0) return null;
  const names = missing.map((course) => `${course.title} (Grade ${course.grade_level})`);
  return `Finish ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`} first.`;
}

export interface PathStep<C extends PathCourse = PathCourse> {
  course: C;
  status: PathStatus;
  /** Why it is locked, in words; null when it isn't. */
  locked_reason: string | null;
  /** Below the student's grade and not started: there for practice. */
  earlier_grade: boolean;
}

/**
 * The path: every course with its status. "next" is the course to take now: the one in progress, else
 * the first unlocked, unstarted course at or above the student's grade, else the first unlocked one.
 */
export function buildPath<C extends PathCourse>(courses: readonly C[], byId: ReadonlyMap<string, PathCourse>, progress: PathProgress): Array<PathStep<C>> {
  const ordered = [...courses].sort((a, b) => a.grade_level - b.grade_level || a.title.localeCompare(b.title));
  const steps: Array<PathStep<C>> = ordered.map((course) => {
    const missing = missingPrerequisites(course, byId, progress);
    const status: PathStatus = progress.completed.has(course.id) ? "done" : progress.inProgress.has(course.id) ? "in_progress" : missing.length ? "locked" : "available";
    return {
      course,
      status,
      locked_reason: status === "locked" ? lockReason(missing) : null,
      earlier_grade: status === "available" && progress.studentGrade !== null && course.grade_level < progress.studentGrade,
    };
  });
  if (!steps.some((step) => step.status === "in_progress")) {
    const next = steps.find((step) => step.status === "available" && !step.earlier_grade) ?? steps.find((step) => step.status === "available");
    if (next) next.status = "next";
  }
  return steps;
}
