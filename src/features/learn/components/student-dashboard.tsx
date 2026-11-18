"use client";

import { Award, NotebookPen, Play, Repeat, Route } from "lucide-react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { pluralize } from "@/lib/format";
import { useAssignments, useBadges, useEnrollments, useLearningSummary } from "../hooks";
import { dueInfo } from "../assignments";
import { AssignmentCard, dueSoon } from "./assignments-list";
import { RecommendedCourses } from "./recommendations";
import { reviewHref } from "./review-overview";
import { useStudent } from "../student-context";
import { CelebrationsSwitch } from "./celebration";
import { BadgeShelf, LearningNumbers, LevelCard, StreakCard } from "./gamification";
import { EnrollmentCard, lessonHref } from "./my-courses";

/**
 * The student's home, the screen they land on (FE-STU-01, with FE-STU-07's gamification): continue
 * learning, questions to review, assigned work due soon, streak and level, recommended next courses, the
 * learning path, badges, courses and certificates. Most urgent first; each part has its own loading and
 * error handling, so one slow part never blanks the page.
 */
export function StudentDashboard() {
  const student = useStudent();
  const summary = useLearningSummary();
  const badges = useBadges();
  const enrollments = useEnrollments();
  const assignments = useAssignments();
  const findHref = student.gradeLevel ? `/grades/${student.gradeLevel}` : "/courses";

  if (summary.isPending) {
    return (
      <div className="grid gap-4" role="status" aria-label="Loading your learning">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }
  if (summary.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="Your learning didn't load"
        description={summary.error.message}
        action={<Button onClick={() => summary.refetch()}>Try again</Button>}
      />
    );
  }
  const data = summary.data;
  const resume = data.continue_learning;
  const now = new Date();
  const soon = assignments.data ? dueSoon(assignments.data, now, student.timezone).slice(0, 3) : [];

  return (
    <div className="grid gap-8">
      <div className={data.review_due > 0 ? "grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid"}>
      {resume ? (
        <Card className="gap-3 bg-accent text-accent-fg sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <p className="text-small font-bold">Continue learning</p>
            <CardTitle as="h2">{resume.lesson.title}</CardTitle>
            <p className="text-small">{resume.course.title}</p>
          </div>
          <ButtonLink href={lessonHref(resume.course.slug, resume.lesson.slug)} className="shrink-0">
            <Play aria-hidden />
            Continue
          </ButtonLink>
        </Card>
      ) : soon[0] ? (
        // Nothing in progress, but work is due: the most useful first step is the soonest assignment.
        <Card className="gap-3 bg-accent text-accent-fg sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <p className="text-small font-bold">Next up: assigned by {soon[0].teacher_name}</p>
            <CardTitle as="h2">{soon[0].title}</CardTitle>
            <p className="text-small">{dueInfo(soon[0].due_at, soon[0].status, now, student.timezone).label}</p>
          </div>
          <ButtonLink href={soon[0].href} className="shrink-0">
            <Play aria-hidden />
            {soon[0].status === "in_progress" ? "Continue" : "Start"}
          </ButtonLink>
        </Card>
      ) : (
        <Card className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <CardTitle as="h2">{data.lessons_completed > 0 ? "What's next?" : "Ready for your first lesson?"}</CardTitle>
            <CardDescription>Pick a course and start its first lesson. Everything you do is saved.</CardDescription>
          </div>
          <ButtonLink href={findHref} className="shrink-0">
            {student.gradeLevel ? `Courses for Grade ${student.gradeLevel}` : "Find a course"}
          </ButtonLink>
        </Card>
      )}
      {data.review_due > 0 && (
        <Card className="gap-2">
          <p className="flex items-center gap-2 text-small font-bold text-fg-muted">
            <Repeat aria-hidden className="size-4" />
            Review
          </p>
          <CardTitle as="h2">{pluralize(data.review_due, "question")} to review</CardTitle>
          <ButtonLink href={reviewHref} variant="secondary" className="mt-auto self-start">
            Start review
          </ButtonLink>
        </Card>
      )}
      </div>

      {soon.length > 0 && (
        <section aria-labelledby="due-heading" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="due-heading" className="text-heading">
              Due soon
            </h2>
            <Link href="/learn/assignments" className="text-small font-bold underline underline-offset-4 hover:no-underline">
              All assignments
            </Link>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {soon.map((assignment) => (
              <li key={assignment.id}>
                <AssignmentCard assignment={assignment} now={now} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StreakCard summary={data} />
        <LevelCard summary={data} />
      </div>
      <LearningNumbers summary={data} />

      <RecommendedCourses />

      <Card className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Route aria-hidden className="size-8 shrink-0" />
          <div className="grid gap-1">
            <CardTitle as="h2">Your learning path</CardTitle>
            <CardDescription>See what you have done in each subject, what comes next, and what opens after that.</CardDescription>
          </div>
        </div>
        <ButtonLink href="/learn/path" variant="secondary" className="shrink-0">
          See my path
        </ButtonLink>
      </Card>

      <section aria-labelledby="badges-heading" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="badges-heading" className="text-heading">
            Badges
          </h2>
          <Link href="/learn/badges" className="text-small font-bold underline underline-offset-4 hover:no-underline">
            All badges ({data.badges_earned} earned)
          </Link>
        </div>
        {badges.isError ? (
          <p className="text-small text-fg-muted">Badges didn&apos;t load. They&apos;ll be back next time.</p>
        ) : badges.data ? (
          <BadgeShelf badges={badges.data} limit={4} />
        ) : (
          <Skeleton className="h-36 w-full" />
        )}
      </section>

      {enrollments.data && enrollments.data.length > 0 && (
        <section aria-labelledby="courses-heading" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="courses-heading" className="text-heading">
              My courses
            </h2>
            <Link href="/learn/courses" className="text-small font-bold underline underline-offset-4 hover:no-underline">
              All my courses
            </Link>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {enrollments.data.slice(0, 2).map((enrollment) => (
              <li key={enrollment.course.id}>
                <EnrollmentCard enrollment={enrollment} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-3">
          <Award aria-hidden className="size-8" />
          <CardTitle as="h2">Certificates</CardTitle>
          <CardDescription>
            {data.certificates > 0 ? `You have ${pluralize(data.certificates, "certificate")}. Look at them, download and print them.` : "Finish a course to earn its certificate."}
          </CardDescription>
          <ButtonLink href="/learn/certificates" variant="secondary" className="mt-auto self-start">
            My certificates
          </ButtonLink>
        </Card>
        <Card className="gap-3">
          <NotebookPen aria-hidden className="size-8" />
          <CardTitle as="h2">Notes and bookmarks</CardTitle>
          <CardDescription>
            {data.notes_count + data.bookmarks_count > 0
              ? `${pluralize(data.notes_count, "note")} and ${pluralize(data.bookmarks_count, "bookmark")}, private to you.`
              : "Write notes and bookmark lessons and video moments as you learn. They all gather here."}
          </CardDescription>
          <ButtonLink href="/learn/notes" variant="secondary" className="mt-auto self-start">
            My notes
          </ButtonLink>
        </Card>
        <Card className="gap-3">
          <CardTitle as="h2">Celebrations</CardTitle>
          <CelebrationsSwitch />
        </Card>
      </div>
    </div>
  );
}
