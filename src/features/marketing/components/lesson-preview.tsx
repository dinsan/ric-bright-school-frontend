"use client";

import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CelebrateIllustration } from "@/components/illustrations";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/**
 * "What a lesson looks like": a tiny, working lesson (Grade 4 fractions) in the shape real lessons take:
 * learn one idea, try it, get feedback straight away. Runs entirely in the browser; nothing is saved.
 */

type Step = "learn" | "try" | "done";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "learn", label: "Learn" },
  { id: "try", label: "Try" },
  { id: "done", label: "Done" },
];

const ORDINALS: Record<number, string> = { 2: "half", 3: "third", 4: "quarter" };

/** A fraction drawn as stacked numbers, read out as words ("one third"). */
function Fraction({ numerator, denominator }: { numerator: number; denominator: number }) {
  return (
    <span className="inline-flex align-middle">
      <span aria-hidden className="inline-flex flex-col items-center px-0.5 text-[0.85em] leading-none font-black">
        <span>{numerator}</span>
        <span className="my-0.5 h-0.5 w-full bg-current" />
        <span>{denominator}</span>
      </span>
      <span className="sr-only">
        {numerator === 1 ? "one" : numerator} {ORDINALS[denominator] ?? `over ${denominator}`}
      </span>
    </span>
  );
}

/** A bar cut into equal parts with the first one shaded. */
function FractionBar({ parts, label }: { parts: number; label: string }) {
  return (
    <figure className="grid gap-2">
      <div role="img" aria-label={label} className="flex h-12 overflow-hidden rounded-control border-2 border-line">
        {Array.from({ length: parts }, (_, index) => (
          <div key={index} className={cn("flex-1 border-line", index > 0 && "border-l-2", index === 0 ? "bg-accent" : "bg-surface")} />
        ))}
      </div>
    </figure>
  );
}

const CHOICES = [
  { id: "maya", label: "Maya", fraction: [1, 2] as const, correct: true },
  { id: "leo", label: "Leo", fraction: [1, 3] as const, correct: false },
  { id: "same", label: "They eat the same", fraction: null, correct: false },
];

export function LessonPreview() {
  const [step, setStep] = useState<Step>("learn");
  const [answer, setAnswer] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // After the person moves on, take focus to the new step's heading (keyboard and screen readers),
  // but never on first render: the page must not jump to the lesson.
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [step]);

  const go = (next: Step) => {
    moved.current = true;
    setStep(next);
    if (next !== "done") setAnswer(null);
  };

  const chosen = CHOICES.find((choice) => choice.id === answer);
  const index = STEPS.findIndex((item) => item.id === step);

  return (
    <Card className="gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="elementary">Grade 4</Badge>
          <Badge>Mathematics</Badge>
          <Badge tone="info">Sample lesson</Badge>
        </div>
        <ol aria-label="Lesson steps" className="flex items-center gap-2 text-small font-bold">
          {STEPS.map((item, position) => (
            <li key={item.id} aria-current={item.id === step ? "step" : undefined} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full border-2 border-line",
                  position < index ? "bg-success text-success-fg" : position === index ? "bg-primary text-primary-fg" : "bg-surface",
                )}
              >
                {position < index ? <Check aria-hidden className="size-4" /> : position + 1}
              </span>
              <span className={cn(position !== index && "max-sm:sr-only")}>{item.label}</span>
              {position < STEPS.length - 1 && <span aria-hidden className="h-0.5 w-4 bg-line-subtle" />}
            </li>
          ))}
        </ol>
      </div>

      {step === "learn" && (
        <div className="grid gap-5">
          <h3 ref={headingRef} tabIndex={-1} className="text-heading outline-none">
            Fractions: the more parts, the smaller each part
          </h3>
          <p>
            A fraction is a part of a whole. The bottom number tells you how many <strong>equal parts</strong> the whole is
            cut into. Here are two bars of the same size:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <FractionBar parts={2} label="A bar cut into 2 equal parts, with 1 part shaded" />
              <p className="text-small">
                Cut into 2 parts: each part is <Fraction numerator={1} denominator={2} />
              </p>
            </div>
            <div className="grid gap-2">
              <FractionBar parts={3} label="A bar cut into 3 equal parts, with 1 part shaded" />
              <p className="text-small">
                Cut into 3 parts: each part is <Fraction numerator={1} denominator={3} />
              </p>
            </div>
          </div>
          <div>
            <Button variant="primary" onClick={() => go("try")}>
              Try a question
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {step === "try" && (
        <div className="grid gap-5">
          <h3 ref={headingRef} tabIndex={-1} className="text-heading outline-none">
            Who eats more pizza?
          </h3>
          <p>
            Maya eats <Fraction numerator={1} denominator={2} /> of a pizza. Leo eats <Fraction numerator={1} denominator={3} /> of a
            pizza the same size. Who eats more?
          </p>
          <div role="group" aria-label="Your answer" className="grid gap-3 sm:grid-cols-3">
            {CHOICES.map((choice) => {
              const picked = answer === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => setAnswer(choice.id)}
                  className={cn(
                    "flex min-h-control items-center justify-center gap-2 rounded-control border-2 border-line px-4 py-3 text-control font-bold shadow-sticker",
                    "transition-transform duration-fast ease-playful hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none",
                    picked ? (choice.correct ? "bg-success text-success-fg" : "bg-danger-soft text-danger-soft-fg") : "bg-surface",
                  )}
                >
                  {picked && (choice.correct ? <Check aria-hidden className="size-5" /> : <X aria-hidden className="size-5" />)}
                  {choice.label}
                  {choice.fraction && (
                    <span className="text-small font-normal">
                      (<Fraction numerator={choice.fraction[0]} denominator={choice.fraction[1]} />)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div aria-live="polite" className="min-h-12">
            {chosen && (
              <p className={cn("rounded-control px-4 py-3", chosen.correct ? "bg-success-soft text-success-soft-fg" : "bg-warning-soft text-warning-soft-fg")}>
                {chosen.correct ? (
                  <>
                    <strong>Yes!</strong> The pizza cut into 2 has bigger pieces than the one cut into 3, so{" "}
                    <Fraction numerator={1} denominator={2} /> is more than <Fraction numerator={1} denominator={3} />.
                  </>
                ) : (
                  <>
                    <strong>Not quite.</strong> Look at the bars again: which shaded part is longer? Try another answer.
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled={!chosen?.correct} onClick={() => go("done")}>
              Finish the lesson
              <ArrowRight aria-hidden />
            </Button>
            <Button variant="ghost" onClick={() => go("learn")}>
              Back to the explanation
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="grid justify-items-start gap-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
          <CelebrateIllustration className="w-40 animate-celebrate" />
          <div className="grid gap-3">
            <h3 ref={headingRef} tabIndex={-1} className="text-heading outline-none">
              Lesson complete!
            </h3>
            <p>That is how every Lumina lesson works: one idea, explained simply, then a question to try with feedback straight away.</p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/grades/4" variant="primary">
                See Grade 4 courses
              </ButtonLink>
              <Button variant="ghost" onClick={() => go("learn")}>
                <RotateCcw aria-hidden />
                Start again
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
