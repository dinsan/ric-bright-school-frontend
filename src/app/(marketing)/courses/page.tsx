import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseGridSkeleton } from "@/features/catalog/components/course-grid";
import { CoursesBrowser } from "@/features/catalog/components/courses-browser";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse courses for Grades 1 to 12 by grade, subject or title.",
};

export default function CoursesPage() {
  return (
    <div className="mx-auto max-w-6xl px-gutter py-10 lg:py-14">
      <h1 className="mb-8 text-title">Courses</h1>
      {/* useSearchParams() needs a Suspense boundary so the page shell can still prerender. */}
      <Suspense fallback={<CourseGridSkeleton />}>
        <CoursesBrowser />
      </Suspense>
    </div>
  );
}
