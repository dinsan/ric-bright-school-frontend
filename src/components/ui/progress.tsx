import { cn } from "@/lib/cn";

export interface ProgressProps {
  value: number;
  max?: number;
  /** What is progressing, for example "Lesson progress". Always announced. */
  label: string;
  /** Show the label and the percentage above the bar. */
  showLabel?: boolean;
  /** Spoken value, for example "3 of 8 steps". Defaults to the percentage. */
  valueText?: string;
  tone?: "primary" | "success" | "accent";
  className?: string;
}

const tones = { primary: "bg-primary", success: "bg-success", accent: "bg-accent" };

/** A determinate progress bar. The fill animates to its new width (instantly with reduced motion). */
export function Progress({ value, max = 100, label, showLabel, valueText, tone = "primary", className }: ProgressProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;
  return (
    <div className={cn("grid gap-1.5", className)}>
      {showLabel && (
        <div className="flex justify-between gap-4 text-small font-bold">
          <span>{label}</span>
          <span className="tabular-nums text-fg-muted">{valueText ?? `${percent}%`}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={valueText ?? `${percent}%`}
        className="h-[calc(var(--check-size)*0.6)] overflow-hidden rounded-full border-2 border-line bg-surface-sunken"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-slow ease-playful", tones[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
