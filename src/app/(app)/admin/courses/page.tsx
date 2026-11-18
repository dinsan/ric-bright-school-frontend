import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CoursesPricing } from "@/features/admin/components/courses-pricing";

export const metadata: Metadata = { title: "Course prices" };

export default function AdminCoursesPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Course prices"
        description="What each course costs. Prices appear on the course pages right away; 0 makes a course free."
      />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <CoursesPricing />
      </Suspense>
    </div>
  );
}
