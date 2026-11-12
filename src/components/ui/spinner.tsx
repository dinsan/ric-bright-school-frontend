import { cn } from "@/lib/cn";

interface SpinnerProps {
  className?: string;
  /** Announced to screen readers. Leave out when the surrounding control already says it is busy. */
  label?: string;
}

/**
 * Indeterminate loading indicator. Keeps turning (slowly) under reduced motion, because a
 * frozen spinner looks like a broken page.
 */
export function Spinner({ className, label }: SpinnerProps) {
  const icon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      data-essential-motion
      className={cn("size-icon animate-spin motion-reduce:[animation-duration:2.4s]", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (!label) return icon;
  return (
    <span role="status" className="inline-flex items-center gap-2">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
