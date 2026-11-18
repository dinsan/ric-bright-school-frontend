"use client";

import { Hourglass, Moon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FocusShell } from "@/components/layout/focus-shell";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { controlState, formatMinutes, type ControlState, type StudentControls } from "../controls";
import { useLearningControls } from "../hooks";

/**
 * The parental controls on the child's side (FE-PAR-03). A parent chose a daily learning time and/or a
 * bedtime, and whether reaching them reminds or pauses:
 * - LearningReminder (the app-shell pages): a calm banner saying so; nothing is blocked there.
 * - LearningControlsGate (lessons, quizzes, review): with "pause", a break screen instead of the page;
 *   with "remind", a one-time reminder and the page as usual.
 * Nothing is ever lost: progress and quiz answers are saved as the child goes, before the pause appears.
 */

/** The time now, updated every minute (bedtime starts and ends on the clock, without any request). */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function useControlState(initial: StudentControls): ControlState {
  const controls = useLearningControls(initial).data ?? initial;
  return controlState(controls, useNow());
}

function messageFor(state: Exclude<ControlState, { kind: "ok" }>): { title: string; text: string } {
  if (state.kind === "bedtime") {
    return state.pause
      ? { title: "It's bedtime", text: `Lessons and quizzes open again at ${state.until}. Everything you did is saved. Sleep well!` }
      : { title: "It's bedtime", text: `Your parent set bedtime until ${state.until}. Time to stop for today?` };
  }
  return state.pause
    ? { title: "Time for a break", text: `You've learned for ${formatMinutes(state.limit)} today, the time your parent chose. Lessons and quizzes open again tomorrow. Everything you did is saved.` }
    : { title: "Time for a break?", text: `You've learned for ${formatMinutes(state.limit)} today, the time your parent chose. Great work! Maybe stop here for today.` };
}

// Reminders shown in this tab, so moving between pages doesn't repeat them ("time_up:2026-11-16").
const reminded = new Set<string>();

/** A one-time toast when a "remind" limit is reached while learning. */
function useReminderToast(state: ControlState) {
  useEffect(() => {
    if (state.kind === "ok" || state.pause) return;
    const key = `${state.kind}:${new Date().toDateString()}`;
    if (reminded.has(key)) return;
    reminded.add(key);
    const { title, text } = messageFor(state);
    toast({ title, description: text });
  }, [state]);
}

/** The app-shell pages: a banner while a limit is reached. */
export function LearningReminder({ initial }: { initial: StudentControls }) {
  const state = useControlState(initial);
  if (state.kind === "ok") return null;
  const { title, text } = messageFor(state);
  return (
    <Alert tone="info" title={title} className="mx-auto mb-6 max-w-5xl">
      {text}
    </Alert>
  );
}

/** Lessons, quizzes and review: the break screen when the parent chose "pause"; the page otherwise. */
export function LearningControlsGate({ initial, children }: { initial: StudentControls; children: ReactNode }) {
  const state = useControlState(initial);
  useReminderToast(state);
  if (state.kind === "ok" || !state.pause) return children;
  const { title, text } = messageFor(state);
  const Icon = state.kind === "bedtime" ? Moon : Hourglass;
  return (
    <FocusShell title={title} exitHref="/learn">
      <div className="grid justify-items-center gap-4 text-center" role="status">
        <span aria-hidden className="inline-flex size-20 items-center justify-center rounded-full border-2 border-line bg-accent text-accent-fg">
          <Icon className="size-10" />
        </span>
        <h1 className="text-title">{title}</h1>
        <p className="max-w-md text-lead">{text}</p>
        <ButtonLink href="/learn">Back to home</ButtonLink>
      </div>
    </FocusShell>
  );
}
