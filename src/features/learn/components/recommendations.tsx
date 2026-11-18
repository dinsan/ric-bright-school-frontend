"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "../hooks";

/**
 * Recommended next courses (FE-STU-01), each with the reason in words ("Next after Fractions Made
 * Simple"). Quietly absent when there is nothing to recommend or it didn't load: it's a suggestion.
 */
export function RecommendedCourses() {
  const recommendations = useRecommendations();
  if (recommendations.isPending) return <Skeleton className="h-40 w-full" />;
  if (recommendations.isError || recommendations.data.length === 0) return null;
  return (
    <section aria-labelledby="recommended-heading" className="grid gap-3">
      <h2 id="recommended-heading" className="text-heading">
        Recommended for you
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {recommendations.data.map(({ course, reason }) => (
          <li key={course.id}>
            <Card asChild interactive className="h-full gap-2">
              <Link href={`/learn/courses/${course.slug}`}>
                <p className="flex items-center gap-1.5 text-caption font-bold text-fg-muted">
                  <Sparkles aria-hidden className="size-3.5" />
                  {reason}
                </p>
                <CardTitle as="h3">{course.title}</CardTitle>
                <p className="text-small text-fg-muted">
                  Grade {course.grade_level} · {course.subject.name}
                </p>
                <p className="line-clamp-2 text-small">{course.summary}</p>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
