import { cn } from "@/lib/cn";

/** Grey placeholder block with the shape of content that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-line-subtle contrast:bg-surface-sunken", className)} />;
}
