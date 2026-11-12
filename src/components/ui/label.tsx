import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface LabelProps extends ComponentProps<"label"> {
  /** Adds "(optional)". Mark the few optional fields rather than the many required ones. */
  optional?: boolean;
}

export function Label({ optional, className, children, ...props }: LabelProps) {
  return (
    <label className={cn("text-small font-bold text-fg", className)} {...props}>
      {children}
      {optional && <span className="font-normal text-fg-muted"> (optional)</span>}
    </label>
  );
}
