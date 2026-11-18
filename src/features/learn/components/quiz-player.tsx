"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, ClipboardList, Flag, PartyPopper, RefreshCw } from "lucide-react";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { FocusShell } from "@/components/layout/focus-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { learnApi } from "../api";
import type { QuizAttempt, QuizAttemptSave, QuizResult, QuizView } from "../contract";
import { useQuizView, useStartQuiz, useSubmitQuiz } from "../hooks";
import { isAnswered, questionTypeHint, type QuizAnswer, type QuizAnswers, type QuizQuestion } from "../quiz";
import { QuizAutosave, type AutosaveState } from "../sync/quiz-autosave";
import { usePlayful } from "./celebration";
import { AnswerInput } from "./quiz-inputs";

export interface QuizPlayerProps {
  /** Read on the server (no loading state on first paint), then kept in the query cache. */
  initial: QuizView;
  /** Where "Save and exit" and "Back to the course" go. */
  exitHref: string;
}

/**
 * The quiz player (FE-ASM-01), in the focused shell. Three screens:
 * - intro: what the quiz is, how it works, the last result, Start (or why it can't start yet);
 * - taking it: one question at a time or all on one page (the quiz's `layout` setting), a question
 *   navigator, flag for review, answers saved as the student goes, and Finish with a confirmation that
 *   lists what is unanswered or flagged;
 * - the result: the score, and how many written answers aren't marked yet.
 * Marking happens on the server; the answers never reach the browser.
 */
export function QuizPlayer({ initial, exitHref }: QuizPlayerProps) {
  const view = useQuizView(initial).data;
  const [attempt, setAttempt] = useState<QuizAttempt | null>(initial.attempt);
  const [result, setResult] = useState<QuizResult | null>(null);
  // Focus the first question when the student has just pressed Start (the button is gone), not on load.
  const [startedHere, setStartedHere] = useState(false);
  const start = useStartQuiz(view.quiz.id);

  const begin = () =>
    start.mutate(undefined, {
      onSuccess: (started) => {
        setResult(null);
        setStartedHere(true);
        setAttempt(started);
      },
      onError: (error) => toast({ title: "The quiz didn't start", description: error.message, tone: "danger" }),
    });

  if (result) return <QuizResultScreen view={view} result={result} exitHref={exitHref} onRetry={begin} retrying={start.isPending} />;
  if (attempt && view.enrolled && view.questions.length > 0) {
    return (
      <QuizTaking
        key={attempt.id}
        view={view}
        attempt={attempt}
        exitHref={exitHref}
        focusOnMount={startedHere}
        onFinished={(finished) => {
          setAttempt(null);
          setResult(finished);
        }}
      />
    );
  }
  return <QuizIntro view={view} exitHref={exitHref} onStart={begin} starting={start.isPending} />;
}

/** The question's heading: focused when the student goes to the question. Question ids are unique in a quiz. */
const questionHeadingId = (questionId: string) => `question-${questionId}`;

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
/** Written answers aren't marked automatically; marking by teachers comes with FE-TCH-09. */
const writtenNotMarked = (count: number) => (count === 1 ? "Your written answer isn't marked yet" : `Your ${count} written answers aren't marked yet`);
const layoutText = { one_at_a_time: "One question at a time", all_on_one_page: "All the questions on one page" } as const;

function QuizIntro({ view, exitHref, onStart, starting }: { view: QuizView; exitHref: string; onStart: () => void; starting: boolean }) {
  const { quiz, last_result: last } = view;
  return (
    <FocusShell title={quiz.title} context={view.course.title} exitHref={exitHref}>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <p className="text-small font-bold text-fg-muted">Quiz</p>
          <h1 className="text-title">{quiz.title}</h1>
          {quiz.description && <p className="text-lead">{quiz.description}</p>}
        </div>
        <ul className="grid gap-2 rounded-card border-2 border-line bg-surface p-card">
          <li className="flex items-center gap-2 font-bold">
            <ClipboardList aria-hidden className="size-5 shrink-0" />
            {plural(quiz.question_count, "question")} · {plural(quiz.points_total, "point")}
          </li>
          <li>{layoutText[quiz.layout]}.</li>
          <li>
            Not sure? Press <strong>Flag for review</strong> and come back to it before you finish.
          </li>
          <li>Your answers are saved as you go, so you can stop and carry on later.</li>
        </ul>
        {last && (
          <p className="font-bold">
            {last.max_score > 0 ? `Last time you got ${last.score} of ${plural(last.max_score, "point")}` : "You finished this quiz before"}
            {last.pending_review > 0 ? `. ${writtenNotMarked(last.pending_review)}.` : "."}
          </p>
        )}
        {!view.enrolled ? (
          <Alert tone="info" title="Start the course first" action={<ButtonLink href={exitHref}>Go to {view.course.title}</ButtonLink>}>
            This quiz is part of {view.course.title}. Start the course, then come back to take it.
          </Alert>
        ) : quiz.question_count === 0 ? (
          <Alert tone="info" title="No questions yet">
            This quiz is still being written. Come back later.
          </Alert>
        ) : (
          <div>
            <Button variant="primary" size="lg" loading={starting} onClick={onStart}>
              {view.attempt ? "Carry on with the quiz" : last ? "Take the quiz again" : "Start the quiz"}
              <ArrowRight aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </FocusShell>
  );
}

const retryable = (error: unknown) => !(error instanceof ApiError) || error.status >= 500 || error.status === 408 || error.status === 429;

/**
 * Autosave for one attempt. The controller lives in an effect (so React's development double-mount gets a
 * fresh one) and sends what is waiting, with keepalive, when the page is hidden or the player goes away.
 */
function useQuizAutosave(attemptId: string) {
  const [state, setState] = useState<AutosaveState>({ status: "idle", error: null });
  const controller = useRef<QuizAutosave<QuizAttemptSave> | null>(null);
  useEffect(() => {
    const autosave = new QuizAutosave<QuizAttemptSave>({
      send: (body, { keepalive }) => learnApi.saveQuizAttempt(attemptId, body, { keepalive }),
      isRetryable: retryable,
      onChange: setState,
    });
    controller.current = autosave;
    const hide = () => {
      if (document.visibilityState === "hidden") autosave.flushOnHide();
    };
    const leave = () => autosave.flushOnHide();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      autosave.flushOnHide();
      autosave.dispose();
      if (controller.current === autosave) controller.current = null;
    };
  }, [attemptId]);
  return { state, controller };
}

function QuizTaking({
  view,
  attempt,
  exitHref,
  focusOnMount,
  onFinished,
}: {
  view: QuizView;
  attempt: QuizAttempt;
  exitHref: string;
  focusOnMount: boolean;
  onFinished: (result: QuizResult) => void;
}) {
  const { questions, quiz } = view;
  const layout = quiz.layout;
  const [answers, setAnswers] = useState<QuizAnswers>(attempt.answers);
  const [flagged, setFlagged] = useState<string[]>(attempt.flagged);
  // One at a time: carry on at the first question not answered yet.
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((question) => !isAnswered(question, attempt.answers[question.id]))));
  const [finishing, setFinishing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const jumpTo = useRef<number | null>(null);
  const autosave = useQuizAutosave(attempt.id);
  const submit = useSubmitQuiz(quiz.id);

  // Every change is saved (the first render is what the server already has).
  useEffect(() => {
    if (answers === attempt.answers && flagged === attempt.flagged) return;
    autosave.controller.current?.update({ answers, flagged });
  }, [answers, flagged, attempt.answers, attempt.flagged, autosave.controller]);

  const focusQuestion = useCallback(
    (at: number) => {
      const question = questions[at];
      if (!question) return;
      requestAnimationFrame(() => {
        const heading = document.getElementById(questionHeadingId(question.id));
        if (!heading) return;
        // Scroll only when the question isn't already in view between the sticky header and footer, so
        // the navigator above it stays on screen when it can.
        const shell = heading.closest("main")?.parentElement;
        const top = shell?.querySelector(":scope > header")?.getBoundingClientRect().bottom ?? 0;
        const bottom = shell?.querySelector(":scope > footer")?.getBoundingClientRect().top ?? window.innerHeight;
        const box = heading.getBoundingClientRect();
        if (box.top < top || box.bottom > bottom) {
          const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          heading.closest("section")?.scrollIntoView?.({ block: "start", behavior: reduced ? "auto" : "smooth" });
        }
        heading.focus({ preventScroll: true });
      });
    },
    [questions],
  );
  const goTo = (at: number) => {
    if (layout === "one_at_a_time") setIndex(at);
    focusQuestion(at);
  };
  useEffect(() => {
    if (focusOnMount) focusQuestion(layout === "one_at_a_time" ? index : 0);
    // Only when the quiz first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable callbacks: with the memoized QuestionCard, typing in one question re-renders only that one
  // (all on one page can hold 30 questions; school Chromebooks are slow).
  const answer = useCallback(
    (questionId: string, value: QuizAnswer | undefined) =>
      setAnswers((current) => {
        const next = { ...current };
        if (value === undefined) delete next[questionId];
        else next[questionId] = value;
        return next;
      }),
    [],
  );
  const toggleFlag = useCallback(
    (questionId: string, number: number, on: boolean) => {
      // Kept in question order, so the list in the Finish dialog reads naturally.
      setFlagged((current) => questions.filter((entry) => (entry.id === questionId ? on : current.includes(entry.id))).map((entry) => entry.id));
      setAnnouncement(on ? `Question ${number} flagged for review.` : `Flag removed from question ${number}.`);
    },
    [questions],
  );

  const answeredCount = questions.filter((question) => isAnswered(question, answers[question.id])).length;
  const finish = () => {
    autosave.controller.current?.pause();
    submit.mutate(
      { attemptId: attempt.id, answers, flagged },
      {
        onSuccess: (result) => {
          autosave.controller.current?.dispose();
          onFinished(result);
        },
        onError: () => autosave.controller.current?.resume(),
      },
    );
  };

  const card = (question: QuizQuestion, at: number, headingLevel: 1 | 2) => (
    <QuestionCard
      key={question.id}
      question={question}
      number={at + 1}
      total={questions.length}
      headingLevel={headingLevel}
      value={answers[question.id]}
      onAnswer={answer}
      flagged={flagged.includes(question.id)}
      onToggleFlag={toggleFlag}
      announce={setAnnouncement}
    />
  );

  const oneAtATime = layout === "one_at_a_time";
  const current = questions[index]!;
  const last = index === questions.length - 1;

  return (
    <FocusShell
      title={quiz.title}
      context={view.course.title}
      exitHref={exitHref}
      progress={oneAtATime ? { current: index + 1, total: questions.length, unit: "question" } : undefined}
      footer={
        oneAtATime ? (
          <>
            <Button onClick={() => goTo(index - 1)} disabled={index === 0}>
              <ArrowLeft aria-hidden />
              Previous
            </Button>
            {last ? (
              <Button variant="primary" onClick={() => setFinishing(true)}>
                Finish quiz
              </Button>
            ) : (
              <Button variant="primary" onClick={() => goTo(index + 1)}>
                Next
                <ArrowRight aria-hidden />
              </Button>
            )}
          </>
        ) : (
          <>
            <span className="text-small font-bold text-fg-muted">
              {answeredCount} of {questions.length} answered
            </span>
            <Button variant="primary" onClick={() => setFinishing(true)}>
              Finish quiz
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-8">
        {!oneAtATime && (
          <div className="grid gap-1">
            <p className="text-small font-bold text-fg-muted">Quiz · {plural(questions.length, "question")}</p>
            <h1 className="text-title">{quiz.title}</h1>
          </div>
        )}
        <QuestionNavigator
          questions={questions}
          answers={answers}
          flagged={flagged}
          current={oneAtATime ? index : null}
          onSelect={goTo}
          onFinish={() => setFinishing(true)}
          saveStatus={<QuizSaveStatus state={autosave.state} onRetry={() => autosave.controller.current?.retry()} />}
        />
        {oneAtATime ? card(current, index, 1) : <div className="grid gap-10">{questions.map((question, at) => card(question, at, 2))}</div>}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </div>

      <FinishDialog
        open={finishing}
        onOpenChange={(open) => {
          setFinishing(open);
          if (!open) submit.reset();
        }}
        questions={questions}
        answers={answers}
        flagged={flagged}
        submitting={submit.isPending}
        error={submit.error}
        onSubmit={finish}
        onJump={(at) => {
          jumpTo.current = at;
          setFinishing(false);
          submit.reset();
        }}
        onClosed={(event) => {
          // "Go to question 3": focus the question, not the button that opened the dialog.
          if (jumpTo.current === null) return;
          event.preventDefault();
          goTo(jumpTo.current);
          jumpTo.current = null;
        }}
      />
    </FocusShell>
  );
}

const QuestionCard = memo(function QuestionCard({
  question,
  number,
  total,
  headingLevel,
  value,
  onAnswer,
  flagged,
  onToggleFlag,
  announce,
}: {
  question: QuizQuestion;
  number: number;
  total: number;
  headingLevel: 1 | 2;
  value: QuizAnswer | undefined;
  onAnswer: (questionId: string, value: QuizAnswer | undefined) => void;
  flagged: boolean;
  onToggleFlag: (questionId: string, number: number, on: boolean) => void;
  announce: (message: string) => void;
}) {
  const ids = useId();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section aria-labelledby={`${ids}-label ${questionHeadingId(question.id)}`} className="grid scroll-mt-32 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-small font-bold text-fg-muted">
          <span id={`${ids}-label`}>
            Question {number} of {total}
          </span>
          <span aria-hidden>·</span>
          <span>{plural(question.points, "point")}</span>
          {flagged && (
            <Badge tone="warning">
              <Flag aria-hidden className="fill-current" />
              Flagged
            </Badge>
          )}
        </p>
        <Button variant={flagged ? "secondary" : "ghost"} size="sm" onClick={() => onToggleFlag(question.id, number, !flagged)}>
          <Flag aria-hidden className={cn(flagged && "fill-current")} />
          {flagged ? "Remove flag" : "Flag for review"}
        </Button>
      </div>
      <Heading id={questionHeadingId(question.id)} tabIndex={-1} className={cn("outline-none", headingLevel === 1 ? "text-title" : "text-heading")}>
        {question.prompt}
      </Heading>
      <p id={`${ids}-hint`} className="-mt-2 text-small text-fg-muted">
        {questionTypeHint[question.type]}
      </p>
      <AnswerInput question={question} value={value} onChange={(next) => onAnswer(question.id, next)} labelledBy={questionHeadingId(question.id)} describedBy={`${ids}-hint`} announce={announce} />
    </section>
  );
});

/**
 * Every question as a numbered button: filled when answered, dashed when not, a flag when flagged (never
 * colour alone), the current one ringed. Each says all of that in words to screen readers.
 */
function QuestionNavigator({
  questions,
  answers,
  flagged,
  current,
  onSelect,
  onFinish,
  saveStatus,
}: {
  questions: QuizQuestion[];
  answers: QuizAnswers;
  flagged: string[];
  current: number | null;
  onSelect: (index: number) => void;
  onFinish: () => void;
  saveStatus: ReactNode;
}) {
  const labelId = useId();
  const answered = questions.filter((question) => isAnswered(question, answers[question.id])).length;
  return (
    <nav aria-labelledby={labelId} className="grid gap-3 rounded-card border-2 border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="grid gap-0.5">
          <p id={labelId} className="font-bold">
            Questions
          </p>
          <p className="text-small text-fg-muted">
            {answered} of {questions.length} answered
            {flagged.length > 0 && ` · ${flagged.length} flagged`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {saveStatus}
          <Button size="sm" onClick={onFinish}>
            Finish quiz
          </Button>
        </div>
      </div>
      <ol className="flex flex-wrap gap-2">
        {questions.map((question, index) => {
          const done = isAnswered(question, answers[question.id]);
          const isFlagged = flagged.includes(question.id);
          const isCurrent = current === index;
          return (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Question ${index + 1}, ${done ? "answered" : "not answered"}${isFlagged ? ", flagged" : ""}`}
                className={cn(
                  "relative inline-flex size-11 items-center justify-center rounded-control border-2 border-line font-bold tabular-nums transition-colors duration-fast",
                  done ? "bg-primary text-primary-fg hover:bg-primary-hover" : "border-dashed bg-surface text-fg hover:bg-surface-sunken",
                  isCurrent && "ring-[3px] ring-fg ring-offset-2 ring-offset-surface",
                )}
              >
                {index + 1}
                {isFlagged && (
                  <span aria-hidden className="absolute -top-2 -right-2 inline-flex size-5 items-center justify-center rounded-full border-2 border-line bg-warning text-warning-fg">
                    <Flag className="size-3 fill-current" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <p aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border-2 border-line bg-primary" /> Answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border-2 border-dashed border-line" /> Not answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flag className="size-3 fill-current" /> Flagged
        </span>
      </p>
    </nav>
  );
}

const saveText: Record<AutosaveState["status"], string> = {
  idle: "",
  pending: "Saving…",
  saving: "Saving…",
  saved: "Saved",
  retrying: "Not saved yet: trying again…",
  failed: "Not saved",
};

function QuizSaveStatus({ state, onRetry }: { state: AutosaveState; onRetry: () => void }) {
  const finishedElsewhere = state.error instanceof ApiError && state.error.code === "attempt_submitted";
  const message = state.status === "failed" && state.error instanceof Error ? `Not saved: ${state.error.message}` : saveText[state.status];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p role="status" aria-live="polite" className="flex min-h-5 items-center gap-1.5 text-caption font-bold text-fg-muted">
        {state.status === "saving" || state.status === "pending" ? (
          <Spinner label="" className="size-3.5" />
        ) : state.status === "saved" ? (
          <Check aria-hidden className="size-4 text-success" />
        ) : state.status === "retrying" ? (
          <RefreshCw aria-hidden className="size-4" />
        ) : state.status === "failed" ? (
          <AlertTriangle aria-hidden className="size-4 text-danger-text" />
        ) : null}
        <span>{message}</span>
      </p>
      {state.status === "failed" &&
        (finishedElsewhere ? (
          // Finished in another tab or device: this page is out of date.
          <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
            See your result
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Try again
          </Button>
        ))}
    </div>
  );
}

function FinishDialog({
  open,
  onOpenChange,
  questions,
  answers,
  flagged,
  submitting,
  error,
  onSubmit,
  onJump,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: QuizQuestion[];
  answers: QuizAnswers;
  flagged: string[];
  submitting: boolean;
  error: Error | null;
  onSubmit: () => void;
  onJump: (index: number) => void;
  onClosed: (event: Event) => void;
}) {
  const keepWorking = useRef<HTMLButtonElement>(null);
  const unanswered = useMemo(() => questions.flatMap((question, index) => (isAnswered(question, answers[question.id]) ? [] : [index])), [questions, answers]);
  const flaggedAt = useMemo(() => questions.flatMap((question, index) => (flagged.includes(question.id) ? [index] : [])), [questions, flagged]);
  const answered = questions.length - unanswered.length;
  const allDone = unanswered.length === 0 && flaggedAt.length === 0;
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent
        title="Finish the quiz?"
        description={`You answered ${answered} of ${plural(questions.length, "question")}.`}
        hideClose
        // Start on the safe choice: Enter by habit must not submit unfinished work.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepWorking.current?.focus();
        }}
        onCloseAutoFocus={onClosed}
        onEscapeKeyDown={(event) => submitting && event.preventDefault()}
      >
        <div className="grid gap-4">
          {unanswered.length > 0 && <JumpList title={`Not answered yet (${unanswered.length})`} indexes={unanswered} onJump={onJump} />}
          {flaggedAt.length > 0 && <JumpList title={`Flagged for review (${flaggedAt.length})`} indexes={flaggedAt} onJump={onJump} flag />}
          <p>{allDone ? "Everything is answered. " : ""}When you finish, your answers are marked and can&apos;t be changed.</p>
          {error && (
            <Alert tone="danger" role="alert" title="Your answers weren't sent">
              {error.message} Your answers are still here: check your connection and press Finish again.
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button ref={keepWorking} onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep working
          </Button>
          <Button variant="primary" loading={submitting} onClick={onSubmit}>
            Finish and submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JumpList({ title, indexes, onJump, flag = false }: { title: string; indexes: number[]; onJump: (index: number) => void; flag?: boolean }) {
  const labelId = useId();
  return (
    <div className="grid gap-2">
      <p id={labelId} className="flex items-center gap-1.5 font-bold">
        {flag && <Flag aria-hidden className="size-4 fill-current" />}
        {title}
      </p>
      {/* Compact numbers (like the navigator), so a long list still fits on a phone; the name says it in full. */}
      <ul aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {indexes.map((index) => (
          <li key={index}>
            <Button size="sm" aria-label={`Go to question ${index + 1}`} className="min-w-11 tabular-nums" onClick={() => onJump(index)}>
              {index + 1}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuizResultScreen({ view, result, exitHref, onRetry, retrying }: { view: QuizView; result: QuizResult; exitHref: string; onRetry: () => void; retrying: boolean }) {
  const playful = usePlayful();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const allRight = result.max_score > 0 && result.score === result.max_score;
  return (
    <FocusShell title={view.quiz.title} context={view.course.title} exitHref={exitHref}>
      <div className="grid justify-items-center gap-4 text-center">
        <span
          aria-hidden
          className={cn("inline-flex size-20 items-center justify-center rounded-full border-2 border-line bg-accent text-accent-fg", playful && allRight && "animate-celebrate")}
        >
          <PartyPopper className="size-10" />
        </span>
        <h1 ref={heading} tabIndex={-1} className="text-title outline-none">
          {allRight ? "Every answer right!" : "Quiz finished"}
        </h1>
        {result.max_score > 0 && (
          <p className="text-lead">
            You got <strong>{result.score}</strong> of {plural(result.max_score, "point")}.
          </p>
        )}
        <p>
          You answered {result.answered} of {plural(result.question_count, "question")}.
        </p>
        {result.pending_review > 0 && (
          <p>
            {writtenNotMarked(result.pending_review)} ({plural(result.pending_points, "point")} not counted yet).
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={exitHref}>Back to the course</ButtonLink>
          <Button loading={retrying} onClick={onRetry}>
            Take the quiz again
          </Button>
        </div>
      </div>
    </FocusShell>
  );
}
