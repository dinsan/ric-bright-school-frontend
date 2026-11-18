"use client";

import { CheckCircle2, ClipboardList, CircleDot } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { QuizSummary } from "../contract";
import { useCourseQuizzes } from "../hooks";

export function quizHref(courseSlug: string, quizSlug: string) {
  return `/learn/courses/${courseSlug}/quizzes/${quizSlug}`;
}

const layoutText = { one_at_a_time: "One question at a time", all_on_one_page: "All on one page" } as const;

function statusOf(quiz: QuizSummary): { text: string; done: boolean; started: boolean } {
  if (quiz.in_progress) return { text: `In progress: ${quiz.in_progress.answered} of ${quiz.question_count} answered`, done: false, started: true };
  const last = quiz.last_result;
  if (last) {
    const score = last.max_score > 0 ? `${last.score} of ${last.max_score} points` : "finished";
    return { text: `Last time: ${score}${last.pending_review > 0 ? ` (+ ${last.pending_review} written, not marked yet)` : ""}`, done: true, started: false };
  }
  return { text: "Not started", done: false, started: false };
}

/**
 * A course's quizzes on the student's course page, with how far the student got in each. Courses without
 * quizzes show nothing. Quizzes open once the course is started, like its lessons.
 */
export function CourseQuizzes({ course, enrolled, initial }: { course: { id: string; slug: string }; enrolled: boolean; initial: QuizSummary[] }) {
  const query = useCourseQuizzes(course.id, initial);
  const quizzes = query.data ?? initial;
  if (quizzes.length === 0) return null;
  return (
    <section aria-labelledby="quizzes-heading" className="grid gap-3">
      <h2 id="quizzes-heading" className="text-heading">
        Quizzes
      </h2>
      <ul className="grid gap-2">
        {quizzes.map((quiz) => {
          const status = statusOf(quiz);
          const Icon = status.done ? CheckCircle2 : status.started ? CircleDot : ClipboardList;
          const inner = (
            <>
              <Icon aria-hidden className={cn("size-5 shrink-0", status.done && "text-success")} />
              <span className="grid min-w-0 flex-1">
                <span className="font-bold wrap-break-word">{quiz.title}</span>
                <span className="text-small text-fg-muted">
                  {quiz.question_count} {quiz.question_count === 1 ? "question" : "questions"} · {layoutText[quiz.layout]} · {status.text}
                </span>
              </span>
            </>
          );
          return (
            <li key={quiz.id}>
              {enrolled ? (
                <Link href={quizHref(course.slug, quiz.slug)} className="flex items-center gap-3 rounded-card border-2 border-line bg-surface px-4 py-3 hover:bg-surface-sunken">
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-card border-2 border-line-subtle bg-surface px-4 py-3">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      {!enrolled && <p className="text-small text-fg-muted">Start the course to take its quizzes.</p>}
    </section>
  );
}
