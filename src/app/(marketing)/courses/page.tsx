import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseGridSkeleton } from "@/features/catalog/components/course-grid";
import { CoursesBrowser } from "@/features/catalog/components/courses-browser";
import { pageMetadata } from "@/lib/seo";

// Filtered views (?grade=, ?subject=, ?q=) are the same page: the canonical URL is /courses.
export const metadata: Metadata = pageMetadata({
  title: "Courses for Grades 1 to 12",
  description: "Browse Lumina's courses for Grades 1 to 12 by grade, subject or title: mathematics, reading and writing, science, history and more.",
  path: "/courses",
});

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
