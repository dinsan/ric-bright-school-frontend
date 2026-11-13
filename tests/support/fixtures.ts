import type { Course, Page, Subject } from "@/features/catalog/types";
import type { Me } from "@/features/auth/contract";

export const maths: Subject = { id: "s1", slug: "mathematics", name: "Mathematics", description: null };
export const science: Subject = { id: "s2", slug: "science", name: "Science", description: null };

export function course(overrides: Partial<Course> = {}): Course {
  return {
    id: overrides.slug ?? "c1",
    slug: "fractions",
    title: "Fractions Made Simple",
    summary: "Halves, quarters and more.",
    description: null,
    grade_level: 4,
    status: "published",
    published_at: "2025-01-15T09:00:00Z",
    created_at: "2025-01-15T09:00:00Z",
    updated_at: "2025-01-15T09:00:00Z",
    subject: maths,
    ...overrides,
  };
}

export function page<T>(items: T[], total = items.length, offset = 0): Page<T> {
  return { items, total, limit: 12, offset };
}

export function me(overrides: Partial<Me> = {}): Me {
  return {
    id: "u1",
    role: "parent",
    display_name: "Pat Parent",
    email: "pat@example.test",
    username: null,
    email_verified: true,
    mfa_enabled: false,
    ...overrides,
  };
}
