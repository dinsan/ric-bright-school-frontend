import { apiFetch, type ApiFetchOptions } from "@/lib/api-client";
import { PAGE_SIZE } from "./constants";
import type { Course, CourseFilters, Page, Subject } from "./types";

// Browser calls to the catalog API (src/app/api/courses, src/app/api/subjects). Server Components use
// src/server/catalog/service.ts directly.

type RequestOptions = Omit<ApiFetchOptions, "searchParams" | "json">;

export function listCourses(filters: CourseFilters, init?: RequestOptions): Promise<Page<Course>> {
  const page = filters.page ?? 1;
  return apiFetch<Page<Course>>("/courses", {
    ...init,
    searchParams: {
      grade_level: filters.gradeLevel,
      subject: filters.subject,
      q: filters.q,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
  });
}

export function getCourseBySlug(slug: string, init?: RequestOptions): Promise<Course> {
  return apiFetch<Course>(`/courses/slug/${encodeURIComponent(slug)}`, init);
}

export function listSubjects(init?: RequestOptions): Promise<Subject[]> {
  return apiFetch<Subject[]>("/subjects", init);
}
