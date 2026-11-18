"use client";

import { Award, CheckCircle2, Circle, CircleDot, Lock, LogOut, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { CourseProgress, QuizSummary } from "../contract";
import { useCourseProgress, useEnroll, useUnenroll } from "../hooks";
import { CourseQuizzes } from "./course-quizzes";
import { lessonHref } from "./my-courses";

export interface CourseHomeProps {
  course: { id: string; slug: string; title: string; summary: string; grade_level: number; subject: { name: string } };
  initial: CourseProgress;
  /** The course's quizzes (FE-ASM-01), read with the page. */
  quizzes?: QuizSummary[];
}

const statusIcon = { completed: CheckCircle2, started: CircleDot, not_started: Circle } as const;
const statusLabel = { completed: "Done", started: "Started", not_started: "Not started" } as const;

/**
 * A course from the student's side (/learn/courses/{slug}): progress, "Start" or "Continue", the outline
 * with each lesson's status, the course's quizzes, and leaving the course (progress is kept).
 */
export function CourseHome({ course, initial, quizzes = [] }: CourseHomeProps) {
  const router = useRouter();
  const progress = useCourseProgress(course.id);
  const data = progress.data ?? initial;
  const enroll = useEnroll();
  const unenroll = useUnenroll();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const { summary } = data;
  const first = data.lessons[0];
  const finished = summary.lessons_total > 0 && summary.percent === 100;

  const start = () =>
    enroll.mutate(course.id, {
      onSuccess: () => first && router.push(lessonHref(course.slug, first.slug)),
      onError: (error) => toast({ title: "The course didn't start", description: error.message, tone: "danger" }),
    });

  return (
    <div className="grid gap-6">
      <Card className="gap-4">
        <p className="text-small font-bold text-fg-muted">
          Grade {course.grade_level} · {course.subject.name}
        </p>
        <p className="text-lead">{course.summary}</p>
        {data.enrolled && (
          <Progress
            value={summary.lessons_completed}
            max={Math.max(1, summary.lessons_total)}
            label="Your progress"
            valueText={`${summary.lessons_completed} of ${summary.lessons_total} lessons · ${summary.percent}%`}
            showLabel
            tone="success"
          />
        )}
        <div className="flex flex-wrap gap-2">
          {!data.enrolled && data.locked_reason ? (
            <p className="flex items-start gap-2 rounded-control border-2 border-line-subtle bg-surface-sunken px-3 py-2 font-bold">
              <Lock aria-hidden className="mt-0.5 size-5 shrink-0" />
              <span>
                <span className="sr-only">Locked:</span> {data.locked_reason}{" "}
                <Link href="/learn/path" className="underline underline-offset-4 hover:no-underline">
                  See your learning path
                </Link>
              </span>
            </p>
          ) : !data.enrolled ? (
            <Button variant="primary" loading={enroll.isPending} onClick={start} disabled={!first}>
              <Play aria-hidden />
              Start this course
            </Button>
          ) : summary.next_lesson ? (
            <ButtonLink href={lessonHref(course.slug, summary.next_lesson.slug)}>
              <Play aria-hidden />
              {summary.lessons_completed === 0 ? "Start" : "Continue"}: {summary.next_lesson.title}
            </ButtonLink>
          ) : (
            finished && (
              <ButtonLink href="/learn/certificates">
                <Award aria-hidden />
                See your certificate
              </ButtonLink>
            )
          )}
          {data.enrolled && (
            <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
              <LogOut aria-hidden />
              Leave this course
            </Button>
          )}
        </div>
      </Card>

      <section aria-labelledby="outline-heading" className="grid gap-3">
        <h2 id="outline-heading" className="text-heading">
          Lessons
        </h2>
        {data.lessons.length === 0 ? (
          <EmptyState illustration="empty" title="No lessons yet" description="This course's lessons are being written." />
        ) : (
          <ol className="grid gap-2">
            {data.lessons.map((lesson) => {
              const Icon = statusIcon[lesson.status];
              const inner = (
                <>
                  <Icon aria-hidden className={cn("size-5 shrink-0", lesson.status === "completed" && "text-success")} />
                  <span className="grid min-w-0 flex-1">
                    <span className="font-bold wrap-break-word">
                      {lesson.position}. {lesson.title}
                    </span>
                    <span className="text-small text-fg-muted">
                      {lesson.duration_minutes ? `${lesson.duration_minutes} min · ` : ""}
                      {statusLabel[lesson.status]}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={lesson.id}>
                  {data.enrolled ? (
                    <Link href={lessonHref(course.slug, lesson.slug)} className="flex items-center gap-3 rounded-card border-2 border-line bg-surface px-4 py-3 hover:bg-surface-sunken">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-card border-2 border-line-subtle bg-surface px-4 py-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <CourseQuizzes course={course} enrolled={data.enrolled} initial={quizzes} />

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent title={`Leave ${course.title}?`} description="It disappears from My courses. What you did is kept: start it again later and you carry on where you stopped.">
          <DialogFooter>
            <DialogClose asChild>
              <Button>Stay</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={unenroll.isPending}
              onClick={() =>
                unenroll.mutate(course.id, {
                  onSuccess: () => {
                    setConfirmLeave(false);
                    router.push("/learn/courses");
                  },
                  onError: (error) => toast({ title: "You're still in the course", description: error.message, tone: "danger" }),
                })
              }
            >
              Leave the course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
