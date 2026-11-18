"use client";

import { Check, PartyPopper, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { FocusShell } from "@/components/layout/focus-shell";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { ReviewAnswerResult, ReviewMode, ReviewQuestion } from "../contract";
import { useAnswerReview, useReviewSession } from "../hooks";
import { describeInterval } from "../spaced";
import { usePlayful } from "./celebration";
import { practiceHref } from "./review-overview";

interface Turn {
  question: ReviewQuestion;
  /** A second try at a question missed earlier in this session: practice only, never rescheduled twice. */
  retry: boolean;
}

/**
 * A review or practice session (FE-STU-10), in the focused shell: one question at a time, instant
 * feedback with the explanation, and the schedule in words ("Next time: in 3 days"). A question missed in
 * review comes back once at the end of the session as practice (learning it now, not counted again).
 * Answers are checked on the server; the right answer arrives only after answering.
 */
export function PracticeSession({ mode, courseId }: { mode: ReviewMode; courseId?: string }) {
  const ids = useId();
  const playful = usePlayful();
  const session = useReviewSession(mode, courseId);
  const answer = useAnswerReview();
  // Questions missed in review, asked once more at the end of the session.
  const [retries, setRetries] = useState<Turn[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewAnswerResult | null>(null);
  const [firstTry, setFirstTry] = useState({ answered: 0, right: 0 });
  const nextButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // The session's questions are fetched once (useReviewSession never refetches), then the retries.
  const turns: Turn[] | null = session.data ? [...session.data.questions.map((question) => ({ question, retry: false })), ...retries] : null;
  useEffect(() => {
    if (result) nextButton.current?.focus();
  }, [result]);

  const title = mode === "review" ? "Review" : "Practice";
  const exit = "/learn/review";

  if (session.isPending || turns === null) {
    return (
      <FocusShell title={title} exitHref={exit}>
        <div className="grid gap-4" role="status" aria-label="Loading your questions">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </FocusShell>
    );
  }
  if (session.isError) {
    return (
      <FocusShell title={title} exitHref={exit}>
        <EmptyState
          illustration="error"
          role="alert"
          title="Your questions didn't load"
          description={session.error.message}
          action={<Button onClick={() => session.refetch()}>Try again</Button>}
        />
      </FocusShell>
    );
  }
  if (turns.length === 0) {
    return (
      <FocusShell title={title} exitHref={exit}>
        <EmptyState
          illustration="celebrate"
          title={mode === "review" ? "Nothing to review right now" : "No questions here yet"}
          description={mode === "review" ? "You're all caught up. Practise anyway, or come back when questions are due." : "Finish a lesson with a quick check first."}
          action={mode === "review" ? <ButtonLink href={practiceHref(courseId)}>Practise anyway</ButtonLink> : <ButtonLink href="/learn/courses">Go to my courses</ButtonLink>}
        />
      </FocusShell>
    );
  }

  // The end of the session.
  if (index >= turns.length) {
    const allRight = firstTry.right === firstTry.answered;
    return (
      <FocusShell title={title} exitHref={exit} progress={{ current: turns.length, total: turns.length, unit: "question" }}>
        <div className="grid justify-items-center gap-4 text-center">
          <span
            aria-hidden
            className={cn("inline-flex size-20 items-center justify-center rounded-full border-2 border-line bg-accent text-accent-fg", playful && allRight && "animate-celebrate")}
          >
            <PartyPopper className="size-10" />
          </span>
          <h1 ref={heading} tabIndex={-1} className="text-title outline-none">
            {allRight ? "Every answer right!" : "Session done"}
          </h1>
          <p className="text-lead">
            You got {firstTry.right} of {firstTry.answered} right first time.
            {mode === "review" && " Each question now comes back when it's due again."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href={exit}>Back to review</ButtonLink>
            {/* A full page load: a new session with fresh questions (the same URL wouldn't reload them). */}
            <a href={practiceHref(courseId)} className={buttonVariants({ variant: "secondary" })}>
              Practise more
            </a>
          </div>
        </div>
      </FocusShell>
    );
  }

  const turn = turns[index]!;
  const { question } = turn;
  const check = () => {
    if (!choice) return;
    answer.mutate(
      { itemId: question.id, choice, mode: turn.retry ? "practice" : mode },
      {
        onSuccess: (outcome) => {
          setResult(outcome);
          if (!turn.retry) setFirstTry((count) => ({ answered: count.answered + 1, right: count.right + (outcome.correct ? 1 : 0) }));
          // Missed in review: once more at the end, to learn it now.
          if (!outcome.correct && mode === "review" && !turn.retry) setRetries((list) => [...list, { question, retry: true }]);
        },
        onError: (error) => toast({ title: "That answer wasn't checked", description: error.message, tone: "danger" }),
      },
    );
  };
  const next = () => {
    setIndex((value) => value + 1);
    setChoice(null);
    setResult(null);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const rightText = question.options.find((option) => option.id === result?.answer)?.text;

  return (
    <FocusShell
      title={title}
      context={question.course.title}
      exitHref={exit}
      progress={{ current: index + 1, total: turns.length, unit: "question" }}
      footer={
        <>
          <span className="text-small text-fg-muted">{turn.retry ? "Second try" : `From “${question.lesson.title}”`}</span>
          {result ? (
            <Button ref={nextButton} variant="primary" onClick={next}>
              {index + 1 < turns.length ? "Next question" : "See how you did"}
            </Button>
          ) : (
            <Button variant="primary" type="submit" form={`${ids}-form`} disabled={!choice} loading={answer.isPending}>
              Check
            </Button>
          )}
        </>
      }
    >
      <form
        id={`${ids}-form`}
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          check();
        }}
      >
        <fieldset className="grid gap-3" disabled={Boolean(result)}>
          <legend className="mb-4">
            <h1 ref={heading} tabIndex={-1} className="text-title outline-none">
              {question.prompt}
            </h1>
          </legend>
          {question.options.map((option) => {
            const isAnswer = result && option.id === result.answer;
            const isWrongChoice = result && !result.correct && option.id === choice;
            return (
              <label
                key={option.id}
                htmlFor={`${ids}-${option.id}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-card border-2 px-4 py-3 text-lead",
                  choice === option.id ? "border-line bg-surface-sunken" : "border-line-subtle bg-surface",
                  isAnswer && "border-success bg-success-soft text-success-soft-fg",
                  isWrongChoice && "border-danger bg-danger-soft text-danger-soft-fg",
                )}
              >
                <input
                  id={`${ids}-${option.id}`}
                  type="radio"
                  name={`${ids}-choice`}
                  value={option.id}
                  checked={choice === option.id}
                  onChange={() => setChoice(option.id)}
                  className="size-5 accent-primary"
                />
                <span className="flex-1">{option.text}</span>
                {isAnswer && <Check aria-hidden className="size-5" />}
                {isWrongChoice && <X aria-hidden className="size-5" />}
              </label>
            );
          })}
        </fieldset>
        <div role="status" aria-live="polite" className="min-h-12">
          {result && (
            <div className={cn("grid gap-1 rounded-card border-2 border-line p-4", result.correct ? "bg-success-soft text-success-soft-fg" : "bg-warning-soft text-warning-soft-fg")}>
              <p className="font-bold">{result.correct ? "Yes, that's right!" : `Not quite. The right answer: “${rightText}”`}</p>
              {result.explanation && <p>{result.explanation}</p>}
              {result.scheduled && <p className="text-small">Next time you&apos;ll see this question {describeInterval(result.interval_days)}.</p>}
            </div>
          )}
        </div>
      </form>
    </FocusShell>
  );
}
