import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { LearningPath } from "@/features/learn/components/learning-path";

export const metadata: Metadata = { title: "Learning path" };

export default function LearningPathPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="Learning path" description="Each subject, course by course: what you have done, what comes next, and what opens after that." />
      {/* useSearchParams (?subject=) needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LearningPath />
      </Suspense>
    </div>
  );
}
