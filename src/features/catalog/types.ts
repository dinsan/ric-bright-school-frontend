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
  /** What the course costs, in cents (0 = free). The currency is site-wide: COURSE_CURRENCY. */
  price_cents: number;
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

// --- Admin (price management, /admin/courses) --------------------------------------------------------

/** What an admin sees in the course list: every status, with the price. */
export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  grade_level: number;
  price_cents: number;
  status: CourseStatus;
  updated_at: string;
  subject: Subject;
}

/** PATCH /admin/courses/{id}. */
export interface CoursePriceUpdate {
  price_cents: number;
}
