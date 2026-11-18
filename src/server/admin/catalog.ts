import "server-only";

import { z } from "zod";
import { MAX_PRICE_CENTS } from "@/features/catalog/constants";
import type { AdminCourse, Page } from "@/features/catalog/types";
import { toSubject } from "@/server/catalog/service";
import { audit } from "@/server/audit";
import type { Auth } from "@/server/auth/context";
import type { Prisma } from "@/generated/prisma/client";
import { escapeLike, getDb, type CourseRow, type SubjectRow } from "@/server/db";
import { notFound } from "@/server/http/errors";

/** Course administration (/api/admin/courses): today, setting each course's price (FE-PUB-07). */

const STATUSES = ["draft", "published", "archived"] as const;

export const courseAdminSearchInput = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

function toAdminCourse(course: CourseRow, subject: SubjectRow): AdminCourse {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    grade_level: course.gradeLevel,
    price_cents: course.priceCents,
    status: course.status,
    updated_at: course.updatedAt.toISOString(),
    subject: toSubject(subject),
  };
}

/** Every course, whatever its status (admins see drafts too), for the price list. */
export async function searchCoursesAdmin({ q, status, limit, offset }: z.output<typeof courseAdminSearchInput>): Promise<Page<AdminCourse>> {
  const db = getDb();
  const where: Prisma.CourseWhereInput = {};
  if (status) where.status = status;
  if (q) {
    const contains = { contains: escapeLike(q), mode: "insensitive" } as const;
    where.OR = [{ title: contains }, { slug: contains }, { subject: { name: contains } }];
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
  return { items: rows.map((row) => toAdminCourse(row, row.subject)), total, limit, offset };
}

export const coursePriceInput = z.object({
  price_cents: z
    .int("Enter the price in cents, for example 1250 for $12.50 (0 makes the course free).")
    .min(0, "A price can't be negative. Use 0 to make the course free.")
    .max(MAX_PRICE_CENTS, "That price is above the maximum ($999.99)."),
});

/** Sets what a course costs. Recorded in audit_events like every admin action. */
export async function updateCoursePrice(auth: Auth, courseId: string, input: z.output<typeof coursePriceInput>, request: Request): Promise<AdminCourse> {
  const db = getDb();
  const course = await db.course.findUnique({ where: { id: courseId }, include: { subject: true } });
  if (!course) throw notFound("That course");
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.course.update({ where: { id: course.id }, data: { priceCents: input.price_cents }, include: { subject: true } });
    await audit(
      request,
      {
        actorId: auth.user.id,
        action: "admin.course_price_updated",
        data: { course_id: course.id, slug: course.slug, from: course.priceCents, to: row.priceCents },
      },
      tx,
    );
    return row;
  });
  return toAdminCourse(updated, updated.subject);
}
