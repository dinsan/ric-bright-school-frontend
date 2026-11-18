import { missingPrerequisites, type PathCourse } from "./path";

/**
 * Recommended next courses (FE-STU-01): a few courses worth starting, each with the reason in words.
 * Simple, explainable rules rather than a black box, in this order of strength:
 *   1. the next course after one the student finished (its prerequisite) — "Next after Fractions Made Simple";
 *   2. more of a subject the student is taking — "More Mathematics";
 *   3. the student's grade, or one step ahead — "For Grade 5", "A step ahead: Grade 6".
 * Never a course already taken or locked, never one far from the student's grade (unless it's the next
 * step of their path). Popularity only breaks ties. Pure: tested without a database.
 */

export interface Candidate extends PathCourse {
  subject: { slug: string; name: string };
  /** How many students take it: a tie-breaker only. */
  popularity: number;
}

export interface Recommendation<C extends Candidate = Candidate> {
  course: C;
  reason: string;
}

export function recommendCourses<C extends Candidate>(
  candidates: readonly C[],
  {
    byId,
    studentGrade,
    enrolled,
    completed,
    activeSubjects,
    limit = 3,
  }: { byId: ReadonlyMap<string, PathCourse>; studentGrade: number | null; enrolled: ReadonlySet<string>; completed: ReadonlySet<string>; activeSubjects: ReadonlySet<string>; limit?: number },
): Array<Recommendation<C>> {
  const scored: Array<{ course: C; score: number; reason: string }> = [];
  for (const course of candidates) {
    if (enrolled.has(course.id) || completed.has(course.id)) continue;
    if (missingPrerequisites(course, byId, { completed, inProgress: new Set(), studentGrade }).length) continue;
    const after = course.requires.map((id) => byId.get(id)).find((required) => required && completed.has(required.id));
    const diff = studentGrade === null ? 0 : course.grade_level - studentGrade;
    if (!after && Math.abs(diff) >= 2) continue;
    // Each rule adds to the score; the strongest rule that applies gives the reason.
    const rules: Array<[applies: boolean, points: number, reason: string]> = [
      [diff === -1, 5, `To practise: Grade ${course.grade_level}`],
      [diff === 1, 15, `A step ahead: Grade ${course.grade_level}`],
      [diff === 0, 30, `For Grade ${course.grade_level}`],
      [activeSubjects.has(course.subject.slug), 20, `More ${course.subject.name}`],
      [Boolean(after), 100, `Next after ${after?.title}`],
    ];
    const applying = rules.filter(([applies]) => applies);
    const score = Math.min(10, course.popularity) + applying.reduce((sum, [, points]) => sum + points, 0);
    scored.push({ course, score, reason: applying.at(-1)?.[2] ?? `For Grade ${course.grade_level}` });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.course.grade_level - b.course.grade_level || a.course.title.localeCompare(b.course.title))
    .slice(0, limit)
    .map(({ course, reason }) => ({ course, reason }));
}
