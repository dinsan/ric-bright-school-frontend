"use client";

import { Award, Play } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { pluralize } from "@/lib/format";
import type { Enrollment } from "../contract";
import { useEnrollments } from "../hooks";
import { useStudent } from "../student-context";

export function lessonHref(courseSlug: string, lessonSlug: string) {
  return `/learn/courses/${courseSlug}/lessons/${lessonSlug}`;
}

/** One course the student takes: progress bar and the way back in. */
export function EnrollmentCard({ enrollment }: { enrollment: Enrollment }) {
  const { course, progress } = enrollment;
  const finished = Boolean(enrollment.completed_at) || (progress.lessons_total > 0 && progress.percent === 100);
  return (
    <Card className="h-full gap-3">
      <div className="flex flex-wrap items-center gap-2 text-small font-bold text-fg-muted">
        Grade {course.grade_level} · {course.subject.name}
        {finished && <Badge tone="success">Finished</Badge>}
      </div>
      <CardTitle as="h2">
        <Link href={`/learn/courses/${course.slug}`} className="underline-offset-4 hover:underline">
          {course.title}
        </Link>
      </CardTitle>
      <Progress
        value={progress.lessons_completed}
        max={Math.max(1, progress.lessons_total)}
        label="Progress"
        valueText={`${progress.lessons_completed} of ${pluralize(progress.lessons_total, "lesson")} done`}
        showLabel
        tone="success"
      />
      <div className="mt-auto flex flex-wrap gap-2">
        {progress.next_lesson ? (
          <ButtonLink href={lessonHref(course.slug, progress.next_lesson.slug)} size="sm">
            <Play aria-hidden />
            {progress.lessons_completed === 0 ? "Start" : "Continue"}: {progress.next_lesson.title}
          </ButtonLink>
        ) : (
          finished && (
            <ButtonLink href="/learn/certificates" size="sm" variant="secondary">
              <Award aria-hidden />
              See the certificate
            </ButtonLink>
          )
        )}
      </div>
    </Card>
  );
}

/** "My courses" (FE-STU-02): every course the student takes, most recent first. */
export function MyCourses() {
  const enrollments = useEnrollments();
  const student = useStudent();
  const findHref = student.gradeLevel ? `/grades/${student.gradeLevel}` : "/courses";

  if (enrollments.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading your courses">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }
  if (enrollments.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="Your courses didn't load"
        description={enrollments.error.message}
        action={<Button onClick={() => enrollments.refetch()}>Try again</Button>}
      />
    );
  }
  if (enrollments.data.length === 0) {
    return (
      <EmptyState
        illustration="empty"
        title="No courses yet"
        description="Find a course you like and start its first lesson: it will be here next time."
        action={<ButtonLink href={findHref}>{student.gradeLevel ? `Courses for Grade ${student.gradeLevel}` : "Find a course"}</ButtonLink>}
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {enrollments.data.map((enrollment) => (
        <li key={enrollment.course.id}>
          <EnrollmentCard enrollment={enrollment} />
        </li>
      ))}
    </ul>
  );
}
