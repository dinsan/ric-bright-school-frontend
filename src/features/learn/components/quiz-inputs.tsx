"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { parseNumber, type QuizAnswer, type QuizQuestion } from "../quiz";

/**
 * The answer inputs of the quiz player (FE-ASM-02), one per question type. Native controls throughout
 * (radios, checkboxes, text boxes, selects, buttons): keyboard, screen readers, phones and forced colours
 * work without custom widgets. Each input is named by the question's prompt (`labelledBy`) and described by
 * its hint (`describedBy`). Answers are plain values (see `QuizAnswer` in quiz.ts); `undefined` clears one.
 */

export interface AnswerInputProps<Q extends QuizQuestion = QuizQuestion> {
  question: Q;
  value: QuizAnswer | undefined;
  onChange: (value: QuizAnswer | undefined) => void;
  /** Id of the prompt: names the group or the box. */
  labelledBy: string;
  /** Id of the hint ("Choose all the answers that are right."). */
  describedBy?: string;
  /** Says something to screen reader users (an item moved). */
  announce: (message: string) => void;
}

type Of<T extends QuizQuestion["type"]> = AnswerInputProps<Extract<QuizQuestion, { type: T }>>;

export function AnswerInput(props: AnswerInputProps) {
  const { question } = props;
  switch (question.type) {
    case "multiple_choice":
      return <SingleChoice {...props} options={question.options} />;
    case "true_false":
      return (
        <SingleChoice
          {...props}
          value={typeof props.value === "boolean" ? String(props.value) : undefined}
          onChange={(value) => props.onChange(value === "true")}
          options={[
            { id: "true", text: "True" },
            { id: "false", text: "False" },
          ]}
          horizontal
        />
      );
    case "multi_select":
      return <MultiSelect {...(props as Of<"multi_select">)} />;
    case "short_answer":
      return <ShortAnswer {...(props as Of<"short_answer">)} />;
    case "numeric":
      return <NumericAnswer {...(props as Of<"numeric">)} />;
    case "fill_blank":
      return <FillBlank {...(props as Of<"fill_blank">)} />;
    case "matching":
      return <Matching {...(props as Of<"matching">)} />;
    case "ordering":
      return <Ordering {...(props as Of<"ordering">)} />;
    case "open_response":
      return <OpenResponse {...(props as Of<"open_response">)} />;
  }
}

/** A big, easy target: the whole card is the label. */
function ChoiceCard({ checked, children }: { checked: boolean; children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-control cursor-pointer items-center gap-3 rounded-card border-2 px-4 py-3 text-lead",
        checked ? "border-line bg-surface-sunken font-bold" : "border-line-subtle bg-surface hover:border-line",
      )}
    >
      {children}
    </label>
  );
}

function SingleChoice({
  value,
  onChange,
  labelledBy,
  describedBy,
  options,
  horizontal = false,
}: Omit<AnswerInputProps, "question" | "onChange"> & { onChange: (value: string) => void; options: Array<{ id: string; text: string }>; horizontal?: boolean }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy} className={cn("grid gap-3", horizontal && "sm:grid-cols-2")}>
      {options.map((option) => (
        <ChoiceCard key={option.id} checked={value === option.id}>
          <input type="radio" name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} className="size-5 shrink-0 accent-primary" />
          <span className="flex-1 wrap-break-word">{option.text}</span>
        </ChoiceCard>
      ))}
    </div>
  );
}

function MultiSelect({ question, value, onChange, labelledBy, describedBy }: Of<"multi_select">) {
  const chosen = Array.isArray(value) ? value : [];
  const toggle = (id: string) => {
    // Keep the options' order, so the saved answer doesn't depend on click order.
    const next = question.options.map((option) => option.id).filter((optionId) => (optionId === id ? !chosen.includes(id) : chosen.includes(optionId)));
    onChange(next.length ? next : undefined);
  };
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="grid gap-3">
      {question.options.map((option) => (
        <ChoiceCard key={option.id} checked={chosen.includes(option.id)}>
          <input type="checkbox" checked={chosen.includes(option.id)} onChange={() => toggle(option.id)} className="size-5 shrink-0 accent-primary" />
          <span className="flex-1 wrap-break-word">{option.text}</span>
        </ChoiceCard>
      ))}
    </div>
  );
}

const text = (value: QuizAnswer | undefined) => (typeof value === "string" ? value : "");
/** An empty box is "not answered" (nothing saved), not an empty answer. */
const orClear = (value: string) => (value.length ? value : undefined);

function ShortAnswer({ question, value, onChange, labelledBy, describedBy }: Of<"short_answer">) {
  return (
    <Input
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      value={text(value)}
      onChange={(event) => onChange(orClear(event.target.value))}
      maxLength={question.max_length}
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      className="max-w-md text-lead"
    />
  );
}

/**
 * A text box, not `type="number"` (FE-DS-17): no changes on mouse-wheel, and the student can type what
 * the question expects (2.5, 2,5 or 3/4). `inputMode` brings up a number keyboard on phones.
 */
function NumericAnswer({ question, value, onChange, labelledBy, describedBy }: Of<"numeric">) {
  const unitId = useId();
  const errorId = useId();
  const [touched, setTouched] = useState(false);
  const typed = text(value);
  const invalid = touched && typed.trim().length > 0 && parseNumber(typed) === null;
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        <Input
          aria-labelledby={question.unit ? `${labelledBy} ${unitId}` : labelledBy}
          aria-describedby={[describedBy, invalid ? errorId : null].filter(Boolean).join(" ") || undefined}
          aria-invalid={invalid || undefined}
          inputMode="decimal"
          autoComplete="off"
          value={typed}
          onChange={(event) => onChange(orClear(event.target.value))}
          onBlur={() => setTouched(true)}
          maxLength={40}
          className="w-40 text-lead tabular-nums"
        />
        {question.unit && (
          <span id={unitId} className="text-lead font-bold">
            {question.unit}
          </span>
        )}
      </div>
      {invalid && (
        <p id={errorId} className="text-small font-bold text-danger-text">
          That isn&apos;t a number yet. Type digits, like 12, 2.5 or 3/4.
        </p>
      )}
    </div>
  );
}

function FillBlank({ question, value, onChange, labelledBy, describedBy }: Of<"fill_blank">) {
  const blanks = question.segments.filter((segment) => segment.kind === "blank");
  const filled = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const set = (id: string, typed: string) => {
    const next = { ...filled, [id]: typed };
    if (!typed.length) delete next[id];
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <p role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="text-lead leading-[2.6]">
      {question.segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <input
            key={segment.id}
            aria-label={`Blank ${blanks.indexOf(segment) + 1} of ${blanks.length}`}
            value={filled[segment.id] ?? ""}
            onChange={(event) => set(segment.id, event.target.value)}
            maxLength={100}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            // Inline with the sentence: wide enough for a word, and wraps with the text on phones.
            className="mx-1 inline-block h-control w-36 max-w-full rounded-control border-2 border-line bg-surface px-2 text-center align-baseline font-bold text-fg"
          />
        ),
      )}
    </p>
  );
}

function Matching({ question, value, onChange, labelledBy, describedBy }: Of<"matching">) {
  const ids = useId();
  const matched = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const set = (leftId: string, rightId: string) => onChange({ ...matched, [leftId]: rightId });
  return (
    // The group on a wrapper: role="group" on the <ul> itself would take away its list semantics.
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      <ul className="grid gap-3">
        {question.left.map((item) => (
          <li key={item.id} className="grid items-center gap-2 rounded-card border-2 border-line-subtle bg-surface px-4 py-3 sm:grid-cols-[1fr_minmax(10rem,16rem)] sm:gap-4">
            <span id={`${ids}-${item.id}`} className="text-lead font-bold wrap-break-word">
              {item.text}
            </span>
            <Select aria-labelledby={`${ids}-${item.id}`} placeholder="Choose a match" value={matched[item.id] ?? ""} onChange={(event) => set(item.id, event.target.value)}>
              {question.right.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.text}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Put items in order with Move up / Move down buttons: one tap or key press each, so it works with a
 * keyboard, a switch, a screen reader and a finger alike (no dragging needed, WCAG 2.5.7). Focus stays on
 * the moved item, and the new place is announced.
 */
function Ordering({ question, value, onChange, labelledBy, describedBy, announce }: Of<"ordering">) {
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());
  const byId = new Map(question.items.map((item) => [item.id, item]));
  const current = Array.isArray(value) && value.length === question.items.length && value.every((id) => byId.has(id)) ? value : question.items.map((item) => item.id);
  const move = (id: string, by: -1 | 1) => {
    const from = current.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= current.length) return;
    const next = [...current];
    [next[from], next[to]] = [next[to]!, next[from]!];
    onChange(next);
    announce(`“${byId.get(id)!.text}” is now number ${to + 1} of ${next.length}.`);
    // At the top or bottom the button just pressed is disabled: keep focus on the item's other button.
    const edge = to === 0 || to === next.length - 1;
    if (edge) requestAnimationFrame(() => buttons.current.get(`${id}:${by === -1 ? "down" : "up"}`)?.focus());
  };
  return (
    <ol aria-labelledby={labelledBy} aria-describedby={describedBy} className="grid gap-2">
      {current.map((id, index) => {
        const item = byId.get(id)!;
        return (
          <li key={id} className="flex items-center gap-3 rounded-card border-2 border-line bg-surface py-2 pr-2 pl-4">
            <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface-sunken font-bold tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-lead wrap-break-word">{item.text}</span>
            <Button
              ref={(element) => void buttons.current.set(`${id}:up`, element)}
              variant="ghost"
              size="icon"
              aria-label={`Move “${item.text}” up`}
              disabled={index === 0}
              onClick={() => move(id, -1)}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              ref={(element) => void buttons.current.set(`${id}:down`, element)}
              variant="ghost"
              size="icon"
              aria-label={`Move “${item.text}” down`}
              disabled={index === current.length - 1}
              onClick={() => move(id, 1)}
            >
              <ArrowDown aria-hidden />
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

function OpenResponse({ question, value, onChange, labelledBy, describedBy }: Of<"open_response">) {
  const countId = useId();
  const typed = text(value);
  const left = question.max_length - typed.length;
  return (
    <div className="grid gap-1.5">
      <Textarea
        aria-labelledby={labelledBy}
        aria-describedby={[describedBy, countId].filter(Boolean).join(" ")}
        value={typed}
        onChange={(event) => onChange(orClear(event.target.value))}
        maxLength={question.max_length}
        rows={6}
        className="text-lead"
      />
      <p id={countId} className="justify-self-end text-caption font-bold tabular-nums text-fg-muted">
        {typed.length} / {question.max_length} characters
      </p>
      {/* Announced only near the limit, not on every key press (FE-DS-18). */}
      <p role="status" className="sr-only">
        {left <= 50 ? `${left} characters left.` : ""}
      </p>
    </div>
  );
}
