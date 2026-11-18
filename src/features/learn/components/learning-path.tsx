"use client";

import { CheckCircle2, CircleDot, Flag, Lock, PlayCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { LearningPathView as PathData } from "../contract";
import type { PathStatus } from "../path";
import { useLearningPath } from "../hooks";

const statusInfo: Record<PathStatus, { label: string; icon: typeof Lock; className: string }> = {
  done: { label: "Done", icon: CheckCircle2, className: "border-line bg-success-soft text-success-soft-fg" },
  in_progress: { label: "In progress", icon: CircleDot, className: "border-line bg-accent text-accent-fg" },
  next: { label: "Next for you", icon: Flag, className: "border-line bg-primary text-primary-fg" },
  available: { label: "Open", icon: PlayCircle, className: "border-line bg-surface text-fg" },
  locked: { label: "Locked", icon: Lock, className: "border-line-subtle bg-surface-sunken text-fg-muted" },
};

type Step = PathData["steps"][number];

function PathStep({ step, studentGrade }: { step: Step; studentGrade: number | null }) {
  const info = statusInfo[step.status];
  const Icon = info.icon;
  const locked = step.status === "locked";
  const href = `/learn/courses/${step.course.slug}`;
  return (
    <li className="group relative grid grid-cols-[3rem_minmax(0,1fr)] gap-4 pb-6 last:pb-0">
      {/* The line joining the steps (decorative). */}
      <span aria-hidden className="absolute top-12 bottom-0 left-6 w-0.5 -translate-x-1/2 bg-line-subtle group-last:hidden" />
      <span aria-hidden className={cn("relative z-10 inline-flex size-12 items-center justify-center rounded-full border-2", info.className)}>
        <Icon className="size-6" />
      </span>
      <div
        className={cn(
          "grid gap-2 rounded-card border-2 p-4",
          step.status === "next" || step.status === "in_progress" ? "border-line bg-surface shadow-sticker" : "border-line-subtle bg-surface",
          locked && "bg-surface-sunken",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={step.status === "done" ? "success" : step.status === "locked" ? "neutral" : step.status === "next" ? "info" : "accent"}>{info.label}</Badge>
          <span className={cn("text-caption font-bold", step.course.grade_level === studentGrade ? "text-fg" : "text-fg-muted")}>
            Grade {step.course.grade_level}
            {step.course.grade_level === studentGrade && " · your grade"}
            {step.earlier_grade && " · for practice"}
          </span>
        </div>
        <h2 className="text-lead font-extrabold">
          {locked ? (
            step.course.title
          ) : (
            <Link href={href} className="underline-offset-4 hover:underline">
              {step.course.title}
            </Link>
          )}
        </h2>
        <p className="text-small text-fg-muted">{step.course.summary}</p>
        {locked && step.locked_reason && (
          <p className="flex items-start gap-2 text-small font-bold">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="sr-only">Locked:</span> {step.locked_reason}
            </span>
          </p>
        )}
        {(step.status === "in_progress" || step.status === "done") && step.lessons_total > 0 && (
          <Progress value={step.lessons_done} max={step.lessons_total} label={`${step.course.title} progress`} valueText={`${step.lessons_done} of ${step.lessons_total} lessons done`} tone="success" />
        )}
        {(step.status === "next" || step.status === "in_progress") && (
          <ButtonLink href={href} size="sm" className="justify-self-start">
            {step.status === "next" ? "Start here" : "Continue"}
          </ButtonLink>
        )}
      </div>
    </li>
  );
}

/**
 * The learning path (FE-STU-09): a subject's courses from the first grade to the last, with what is
 * done, what is next and what is locked (and why). The subject is in the URL (?subject=), so the back
 * button and links work.
 */
export function LearningPath() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const subject = params.get("subject") ?? undefined;
  const path = useLearningPath(subject);

  if (path.isPending) {
    return (
      <div className="grid gap-4" role="status" aria-label="Loading your learning path">
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (path.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="The learning path didn't load"
        description={path.error.message}
        action={<Button onClick={() => path.refetch()}>Try again</Button>}
      />
    );
  }
  const data = path.data;
  const done = data.steps.filter((step) => step.status === "done").length;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <FormField label="Subject" className="w-64">
          <Select value={data.subject.slug} onChange={(event) => router.replace(`${pathname}?subject=${encodeURIComponent(event.target.value)}`, { scroll: false })}>
            {data.subjects.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.name}
              </option>
            ))}
          </Select>
        </FormField>
        <p className="text-small font-bold text-fg-muted" aria-live="polite">
          {data.subject.name}: {done} of {data.steps.length} courses done
        </p>
      </div>
      {data.steps.length === 0 ? (
        <EmptyState illustration="empty" title={`No ${data.subject.name} courses yet`} description="Choose another subject." />
      ) : (
        <ol aria-label={`${data.subject.name} learning path`} className="grid">
          {data.steps.map((step) => (
            <PathStep key={step.course.id} step={step} studentGrade={data.student_grade} />
          ))}
        </ol>
      )}
      <p className="text-small text-fg-muted">
        A course opens when you have finished the one before it. Courses from earlier grades than yours are always open: you learned them at school.
      </p>
    </div>
  );
}
