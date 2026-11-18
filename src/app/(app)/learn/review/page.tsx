import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ReviewOverview } from "@/features/learn/components/review-overview";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader title="Review and practice" description="Questions from the lessons you finished come back just before you would forget them." />
      <ReviewOverview />
    </div>
  );
}
