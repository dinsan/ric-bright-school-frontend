import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CoursesNav, Notebook } from "@/features/learn/components/notebook";

export const metadata: Metadata = { title: "Notes and bookmarks" };

export default function NotesPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader title="Notes and bookmarks" description="Everything you wrote down or marked in your lessons. Private: your teachers and classmates can't see it." />
      <CoursesNav />
      {/* useSearchParams (?q=) needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <Notebook />
      </Suspense>
    </div>
  );
}
