"use client";

import { Dumbbell, Repeat } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, pluralize } from "@/lib/format";
import { useReviewOverview } from "../hooks";
import { describeInterval, REVIEW_INTERVALS_DAYS } from "../spaced";

export const reviewHref = "/learn/review/session?mode=review";
export const practiceHref = (courseId?: string) => `/learn/review/session?mode=practice${courseId ? `&course=${encodeURIComponent(courseId)}` : ""}`;

/**
 * /learn/review (FE-STU-10): the review queue (questions due now) and practice mode (any question,
 * weakest first, without changing the schedule), per course, with how the spacing works in plain words.
 */
export function ReviewOverview() {
  const overview = useReviewOverview();
  if (overview.isPending) {
    return (
      <div className="grid gap-4" role="status" aria-label="Loading your review">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (overview.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="Your review didn't load"
        description={overview.error.message}
        action={<Button onClick={() => overview.refetch()}>Try again</Button>}
      />
    );
  }
  const data = overview.data;
  if (data.total_count === 0) {
    return (
      <EmptyState
        illustration="empty"
        title="Nothing to review yet"
        description="Finish a lesson with a quick check: its questions come back here the next day, so what you learned sticks."
        action={<ButtonLink href="/learn/courses">Go to my courses</ButtonLink>}
      />
    );
  }
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <Repeat aria-hidden className="size-8" />
          <CardTitle as="h2">{data.due_count > 0 ? `${pluralize(data.due_count, "question")} to review` : "All caught up"}</CardTitle>
          <CardDescription>
            {data.due_count > 0
              ? "Questions from lessons you finished, back at just the right time. It takes a few minutes."
              : data.next_due_at
                ? `Your next review is on ${formatDate(data.next_due_at)}. Practise any time meanwhile.`
                : "Practise any time."}
          </CardDescription>
          {data.due_count > 0 && (
            <ButtonLink href={reviewHref} className="mt-auto self-start">
              Start review
            </ButtonLink>
          )}
        </Card>
        <Card className="gap-3">
          <Dumbbell aria-hidden className="size-8" />
          <CardTitle as="h2">Practice</CardTitle>
          <CardDescription>Any of your {pluralize(data.total_count, "question")}, the ones you find hardest first. Practice never changes your review dates.</CardDescription>
          <ButtonLink href={practiceHref()} variant="secondary" className="mt-auto self-start">
            Practise everything
          </ButtonLink>
        </Card>
      </div>

      <section aria-labelledby="review-courses" className="grid gap-3">
        <h2 id="review-courses" className="text-heading">
          By course
        </h2>
        <ul className="grid gap-2">
          {data.courses.map((entry) => (
            <li key={entry.course.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-line bg-surface px-4 py-3">
              <span className="grid">
                <span className="font-bold">{entry.course.title}</span>
                <span className="text-small text-fg-muted">
                  {pluralize(entry.questions, "question")}
                  {entry.due > 0 && ` · ${entry.due} due now`}
                </span>
              </span>
              <ButtonLink href={practiceHref(entry.course.id)} size="sm" variant="secondary">
                Practise <span className="sr-only">{entry.course.title}</span>
              </ButtonLink>
            </li>
          ))}
        </ul>
      </section>

      <details className="rounded-card border-2 border-line-subtle bg-surface px-4 py-3">
        <summary className="cursor-pointer font-bold">How review works</summary>
        <p className="mt-2 max-w-prose text-small">
          Every right answer sends a question further away: it comes back {REVIEW_INTERVALS_DAYS.map(describeInterval).join(", then ")}. A wrong answer
          brings it back tomorrow, so you see it again while it still needs practice. Questions you know well hardly come back at all.
        </p>
      </details>
    </div>
  );
}
