"use client";

import { CalendarClock, CheckCircle2, Play } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { dueInfo, type DueTone } from "../assignments";
import type { StudentAssignment } from "../contract";
import { useAssignments } from "../hooks";
import { useStudent } from "../student-context";

const toneBadge: Record<DueTone, BadgeTone> = { overdue: "danger", today: "warning", soon: "warning", later: "neutral", done: "success" };

/** One piece of assigned work: what, for which class, when, how far along, and the way in. */
export function AssignmentCard({ assignment, now = new Date() }: { assignment: StudentAssignment; now?: Date }) {
  const student = useStudent();
  const due = dueInfo(assignment.due_at, assignment.status, now, student.timezone);
  const done = assignment.status === "done";
  return (
    <Card variant="flat" className={cn("h-full gap-3", done && "opacity-80")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={toneBadge[due.tone]}>
          {done ? <CheckCircle2 aria-hidden className="size-3.5" /> : <CalendarClock aria-hidden className="size-3.5" />}
          {due.label}
        </Badge>
        <span className="text-caption font-bold text-fg-muted">
          {assignment.class_name} · {assignment.teacher_name}
        </span>
      </div>
      <CardTitle as="h3">
        <Link href={assignment.href} className="underline-offset-4 hover:underline">
          {assignment.title}
        </Link>
      </CardTitle>
      <p className="text-small text-fg-muted">
        {assignment.lesson ? `Lesson ${assignment.lesson.position} of ${assignment.course.title}` : `The whole course: ${assignment.course.title}`}
      </p>
      {assignment.instructions && <p className="text-small">{assignment.instructions}</p>}
      {assignment.lessons_total > 1 && (
        <Progress
          value={assignment.lessons_done}
          max={assignment.lessons_total}
          label="Progress"
          valueText={`${assignment.lessons_done} of ${assignment.lessons_total} lessons done`}
          showLabel
          tone="success"
        />
      )}
      {!done && (
        <ButtonLink href={assignment.href} size="sm" className="mt-auto self-start">
          <Play aria-hidden />
          {assignment.status === "in_progress" ? "Continue" : "Start"}
        </ButtonLink>
      )}
    </Card>
  );
}

/** Not done and due within 7 days (or overdue), soonest first: the dashboard's "Due soon". */
export function dueSoon(assignments: StudentAssignment[], now: Date, timezone: string | null) {
  return assignments.filter((entry) => entry.status !== "done" && dueInfo(entry.due_at, entry.status, now, timezone).days <= 7);
}

/** /learn/assignments: all assigned work, grouped by urgency. */
export function AssignmentsList() {
  const assignments = useAssignments();
  const student = useStudent();
  const now = new Date();

  if (assignments.isPending) {
    return (
      <div className="grid gap-3" role="status" aria-label="Loading your assignments">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (assignments.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="Your assignments didn't load"
        description={assignments.error.message}
        action={<Button onClick={() => assignments.refetch()}>Try again</Button>}
      />
    );
  }
  if (assignments.data.length === 0) {
    return (
      <EmptyState
        illustration="celebrate"
        title="No assignments"
        description="When your teacher sets work for your class, it appears here with its due date. Until then, carry on with your own courses."
        action={<ButtonLink href="/learn/courses">Go to my courses</ButtonLink>}
      />
    );
  }

  const info = (entry: StudentAssignment) => dueInfo(entry.due_at, entry.status, now, student.timezone);
  const groups: Array<{ id: string; title: string; items: StudentAssignment[] }> = [
    { id: "overdue", title: "Overdue", items: assignments.data.filter((entry) => info(entry).tone === "overdue") },
    { id: "soon", title: "Due this week", items: assignments.data.filter((entry) => ["today", "soon"].includes(info(entry).tone)) },
    { id: "later", title: "Later", items: assignments.data.filter((entry) => info(entry).tone === "later") },
    { id: "done", title: "Done", items: assignments.data.filter((entry) => entry.status === "done") },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="grid gap-8">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`assignments-${group.id}`} className="grid gap-3">
          <h2 id={`assignments-${group.id}`} className="text-heading">
            {group.title} <span className="text-lead text-fg-muted">({group.items.length})</span>
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {group.items.map((assignment) => (
              <li key={assignment.id}>
                <AssignmentCard assignment={assignment} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
