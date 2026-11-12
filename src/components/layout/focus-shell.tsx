import { X } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SkipLink } from "./skip-link";

export interface FocusShellProps {
  /** The lesson or quiz name. */
  title: string;
  /** Context above the title, for example the course name. */
  context?: string;
  /** Where "Save and exit" goes. Progress is saved as the learner goes, so leaving is always safe. */
  exitHref: string;
  progress?: { current: number; total: number; unit?: string };
  /** Previous / next controls, kept in reach at the bottom of the screen. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Lessons and quizzes: nothing on screen except the task. No navigation, no footer links, no
 * background pattern, a comfortable reading width, and one clear way out.
 */
export function FocusShell({ title, context, exitHref, progress, footer, children }: FocusShellProps) {
  const unit = progress?.unit ?? "step";
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SkipLink />
      <header className="sticky top-0 z-sticky border-b-2 border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-gutter py-3">
          <ButtonLink href={exitHref} variant="ghost" size="icon" aria-label="Save and exit" className="-ml-2">
            <X aria-hidden />
          </ButtonLink>
          <div className="min-w-0 flex-1">
            {context && <p className="truncate text-caption font-bold text-fg-muted">{context}</p>}
            <p className="truncate font-bold">{title}</p>
          </div>
          {progress && (
            <p className="shrink-0 text-small font-bold tabular-nums text-fg-muted">
              {progress.current} of {progress.total}
            </p>
          )}
        </div>
        {progress && (
          <div className="mx-auto max-w-3xl px-gutter pb-3">
            <Progress
              value={progress.current}
              max={progress.total}
              label={`${title} progress`}
              valueText={`${unit} ${progress.current} of ${progress.total}`}
              tone="success"
            />
          </div>
        )}
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-gutter py-8 outline-none sm:py-12">
        {children}
      </main>
      {footer && (
        <footer className="sticky bottom-0 z-sticky border-t-2 border-line bg-surface">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-gutter py-3">{footer}</div>
        </footer>
      )}
    </div>
  );
}
