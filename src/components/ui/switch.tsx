"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps extends Omit<ComponentProps<"input">, "type" | "role"> {
  label: ReactNode;
  description?: ReactNode;
}

/**
 * An on/off setting that applies immediately. A native checkbox with role="switch", so screen
 * readers say "on" / "off", it works with `register`, and the label is clickable.
 * Use a Checkbox instead when the choice is only saved on submit.
 */
export function Switch({ label, description, className, id, ...props }: SwitchProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <span className="grid gap-0.5">
        <label htmlFor={inputId} className="cursor-pointer text-body font-medium leading-snug text-fg">
          {label}
        </label>
        {description && (
          <span id={descriptionId} className="text-small text-fg-muted">
            {description}
          </span>
        )}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          id={inputId}
          aria-describedby={descriptionId}
          className={cn(
            "peer h-check w-[calc(var(--check-size)*1.85)] cursor-pointer appearance-none rounded-full border-2 border-line bg-surface-sunken",
            "transition-colors duration-fast checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
            "forced-colors:appearance-auto",
          )}
          {...props}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 left-[3px] size-[calc(var(--check-size)-10px)] -translate-y-1/2 rounded-full border-2 border-line bg-surface",
            "transition-transform duration-fast ease-playful",
            "peer-checked:translate-x-[calc(var(--check-size)*0.85+4px)] forced-colors:hidden",
          )}
        />
      </span>
    </div>
  );
}
