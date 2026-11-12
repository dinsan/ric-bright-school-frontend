"use client";

import { Check } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { withFormError } from "./field-context";
import { FieldError } from "./form-field";

export interface CheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  label: ReactNode;
  description?: ReactNode;
  error?: string;
}

/** Shared box for Checkbox and Radio: a native input, restyled. Works with `register` and without JS. */
export const choiceInputClass =
  "peer relative size-check shrink-0 cursor-pointer appearance-none border-2 border-line bg-surface " +
  "transition-colors duration-fast checked:border-line checked:bg-primary " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger " +
  "forced-colors:appearance-auto";

/** A native checkbox with its label beside it. Inside a <Form>, its error is read by `name`. */
export const Checkbox = withFormError(CheckboxView);

function CheckboxView({ label, description, error, className, id, ...props }: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={cn("grid gap-1", className)}>
      <div className="flex items-start gap-3">
        <span className="relative mt-px inline-flex">
          <input
            type="checkbox"
            id={inputId}
            aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
            aria-invalid={error ? true : undefined}
            className={cn(choiceInputClass, "rounded-[calc(var(--control-radius)*0.6)]")}
            {...props}
          />
          <Check
            aria-hidden
            strokeWidth={3.5}
            className="pointer-events-none absolute inset-0 m-auto hidden size-[70%] text-primary-fg peer-checked:block forced-colors:hidden"
          />
        </span>
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
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
