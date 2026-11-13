import "server-only";

import { z } from "zod";
import { MAX_GRADE, MIN_GRADE, PAGE_SIZE } from "@/features/catalog/constants";
import type { Course, Page, Subject } from "@/features/catalog/types";
import type { Prisma } from "@/generated/prisma/client";
import { escapeLike, getDb, type CourseRow, type SubjectRow } from "@/server/db";

/** The public course catalog: published courses only. */

export const courseSearchInput = z.object({
  grade_level: z.coerce.number().int().min(MIN_GRADE).max(MAX_GRADE).optional(),
  subject: z.string().trim().max(80).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export function toSubject(subject: SubjectRow): Subject {
  return { id: subject.id, slug: subject.slug, name: subject.name, description: subject.description };
}

export function toCourse(course: CourseRow, subject: SubjectRow): Course {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    description: course.description,
    grade_level: course.gradeLevel,
    status: course.status,
    published_at: course.publishedAt?.toISOString() ?? null,
    created_at: course.createdAt.toISOString(),
    updated_at: course.updatedAt.toISOString(),
    subject: toSubject(subject),
  };
}

export async function listCourses({ grade_level, subject, q, limit, offset }: z.output<typeof courseSearchInput>): Promise<Page<Course>> {
  const db = getDb();
  const where: Prisma.CourseWhereInput = { status: "published" };
  if (grade_level !== undefined) where.gradeLevel = grade_level;
  if (subject) where.subject = { slug: subject };
  if (q) {
    const contains = { contains: escapeLike(q), mode: "insensitive" } as const;
    where.OR = [{ title: contains }, { summary: contains }];
  }
  const [rows, total] = await Promise.all([
    db.course.findMany({
      where,
      include: { subject: true },
      orderBy: [{ gradeLevel: "asc" }, { title: "asc" }, { id: "asc" }],
      take: limit,
      skip: offset,
    }),
    db.course.count({ where }),
  ]);
  return { items: rows.map((row) => toCourse(row, row.subject)), total, limit, offset };
}

/** A published course, or null. */
export async function getCourseBySlug(slug: string): Promise<Course | null> {
  if (slug.length > 120) return null;
  const row = await getDb().course.findUnique({ where: { slug, status: "published" }, include: { subject: true } });
  return row ? toCourse(row, row.subject) : null;
}

export async function listSubjects(): Promise<Subject[]> {
  const rows = await getDb().subject.findMany({ orderBy: { name: "asc" } });
  return rows.map(toSubject);
}

// --- Public site ------------------------------------------------------------------------------------

export interface SubjectSummary extends Subject {
  course_count: number;
  min_grade: number;
  max_grade: number;
}

export interface CatalogOverview {
  course_count: number;
  /** Subjects with at least one published course, most courses first. */
  subjects: SubjectSummary[];
  /** Published courses per grade, 1 to 12 (0 when none). */
  courses_per_grade: Record<number, number>;
}

/** What the home page shows about the catalog: real numbers, from published courses only. */
export async function catalogOverview(): Promise<CatalogOverview> {
  const db = getDb();
  const published = { status: "published" } as const;
  const [bySubject, byGrade] = await Promise.all([
    db.course.groupBy({ by: ["subjectId"], where: published, _count: { _all: true }, _min: { gradeLevel: true }, _max: { gradeLevel: true } }),
    db.course.groupBy({ by: ["gradeLevel"], where: published, _count: { _all: true } }),
  ]);
  // Subjects in name order (database collation), then most courses first: Array.sort is stable.
  const subjectRows = await db.subject.findMany({ where: { id: { in: bySubject.map((row) => row.subjectId) } }, orderBy: { name: "asc" } });
  const stats = new Map(bySubject.map((row) => [row.subjectId, row]));
  const summaries: SubjectSummary[] = subjectRows.map((subject) => {
    const row = stats.get(subject.id)!;
    return {
      ...toSubject(subject),
      course_count: row._count._all,
      min_grade: row._min.gradeLevel ?? MIN_GRADE,
      max_grade: row._max.gradeLevel ?? MAX_GRADE,
    };
  });
  summaries.sort((a, b) => b.course_count - a.course_count);

  const perGrade: Record<number, number> = Object.fromEntries(Array.from({ length: MAX_GRADE - MIN_GRADE + 1 }, (_, index) => [MIN_GRADE + index, 0]));
  for (const row of byGrade) perGrade[row.gradeLevel] = row._count._all;
  return {
    course_count: byGrade.reduce((sum, row) => sum + row._count._all, 0),
    subjects: summaries,
    courses_per_grade: perGrade,
  };
}

/** Every published course, for the sitemap. */
export async function publishedCourseUrls(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return getDb().course.findMany({
    where: { status: "published" },
    select: { slug: true, updatedAt: true },
    orderBy: [{ gradeLevel: "asc" }, { slug: "asc" }],
  });
}

/** A course's lessons, in order (the outline on the course page). */
export async function courseLessons(courseId: string) {
  return getDb().lesson.findMany({
    where: { courseId },
    select: { id: true, slug: true, title: true, summary: true, position: true, durationMinutes: true },
    orderBy: { position: "asc" },
  });
}
