// The catalog API's JSON shapes, shared by the browser (./api.ts) and the server that produces them
// (src/server/catalog/service.ts), so the compiler checks both ends.

export type CourseStatus = "draft" | "published" | "archived";

export interface Subject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  grade_level: number;
  status: CourseStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  subject: Subject;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface CourseFilters {
  gradeLevel?: number;
  subject?: string;
  q?: string;
  page?: number;
}
