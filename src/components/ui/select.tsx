"use client";

import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClass } from "./input";
import { useFieldControl } from "./field-context";

/**
 * A styled native <select>. Native on purpose: it is the most reliable picker on phones and
 * tablets (where most young learners are), works with screen readers and with react-hook-form's
 * `register`, and needs no JavaScript.
 * min-w-0: a native select is otherwise as wide as its longest option and overflows small screens.
 */
export interface SelectProps extends ComponentProps<"select"> {
  /**
   * Prompt shown while nothing is chosen, for example "Choose a subject". It has the value "" and
   * cannot be picked again, so "nothing chosen" always means "" (what validation treats as missing).
   */
  placeholder?: string;
}

export function Select({ className, children, placeholder, ...props }: SelectProps) {
  const wired = useFieldControl(props);
  // Uncontrolled with a placeholder: start on the placeholder instead of the first real option.
  const initial = placeholder && props.value === undefined && props.defaultValue === undefined ? { defaultValue: "" } : {};
  return (
    <span className="relative block min-w-0">
      <select className={cn(controlClass, "block h-control min-w-0 appearance-none truncate pr-10", className)} {...initial} {...wired}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-icon -translate-y-1/2 text-fg" />
    </span>
  );
}
