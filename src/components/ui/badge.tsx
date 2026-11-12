import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent" | "elementary" | "middle" | "high";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-fg border-line-subtle",
  info: "bg-info-soft text-info-soft-fg border-transparent",
  success: "bg-success-soft text-success-soft-fg border-transparent",
  warning: "bg-warning-soft text-warning-soft-fg border-transparent",
  danger: "bg-danger-soft text-danger-soft-fg border-transparent",
  accent: "bg-accent text-accent-fg border-line",
  elementary: "bg-band-elementary text-band-elementary-fg border-line",
  middle: "bg-band-middle text-band-middle-fg border-line",
  high: "bg-band-high text-band-high-fg border-line",
};

export interface BadgeProps extends ComponentProps<"span"> {
  tone?: BadgeTone;
}

/** Short status or category label. Not interactive; use a Button for actions. */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-caption font-bold whitespace-nowrap [&_svg]:size-[1.1em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
