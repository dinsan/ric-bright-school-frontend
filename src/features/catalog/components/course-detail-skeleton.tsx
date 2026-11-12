import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { courseDetailLayout as layout } from "./course-detail-layout";

/** Placeholder with the same shape as the course detail page, shown while the course loads. */
export function CourseDetailSkeleton() {
  return (
    <div className={layout.page} role="status" aria-label="Loading course">
      <Skeleton className="mb-8 h-5 w-40" />
      <div className={layout.columns}>
        <div>
          <Skeleton className={layout.gradeMark} />
          <Skeleton className="h-9 w-full max-w-xl sm:h-12" />
          <Skeleton className="mt-3 h-9 w-2/3 max-w-md sm:h-12" />
          <div className="mt-6 grid max-w-2xl gap-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
          </div>
          <div className="mt-10 grid max-w-2xl gap-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <Card variant="flat" className={layout.aside}>
          <div className={layout.facts}>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="grid gap-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
