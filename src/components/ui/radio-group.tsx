"use client";

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { choiceInputClass } from "./checkbox";
import { withFormError } from "./field-context";
import { FieldError } from "./form-field";

interface RadioGroupContextValue {
  invalid: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue>({ invalid: false });

export interface RadioGroupProps {
  legend: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  /** The radios' field name. Inside a <Form>, used to read the group's error. */
  name?: string;
  /** Lay the options out in a row on wider screens. */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * A group of native radio buttons in a fieldset (the legend names the group for screen readers;
 * role="radiogroup" lets the group carry aria-invalid).
 * Arrow keys move between options, as browsers do for native radios.
 */
export const RadioGroup = withFormError(RadioGroupView);

function RadioGroupView({ legend, hint, error, children, orientation = "vertical", className }: RadioGroupProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      role="radiogroup"
      className={cn("grid gap-2", className)}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1 text-small font-bold text-fg">{legend}</legend>
      {hint && (
        <p id={hintId} className="-mt-1 text-small text-fg-muted">
          {hint}
        </p>
      )}
      <RadioGroupContext.Provider value={{ invalid: Boolean(error) }}>
        <div className={cn("grid gap-2.5", orientation === "horizontal" && "sm:flex sm:flex-wrap sm:gap-x-6")}>{children}</div>
      </RadioGroupContext.Provider>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  );
}

export interface RadioProps extends Omit<ComponentProps<"input">, "type"> {
  label: ReactNode;
  description?: ReactNode;
}

export function Radio({ label, description, className, id, ...props }: RadioProps) {
  const group = useContext(RadioGroupContext);
  const generated = useId();
  const inputId = id ?? generated;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-px inline-flex">
        <input
          type="radio"
          id={inputId}
          aria-describedby={descriptionId}
          className={cn(choiceInputClass, "rounded-full checked:bg-surface", group.invalid && "border-danger")}
          {...props}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto hidden size-[45%] rounded-full bg-primary peer-checked:block forced-colors:hidden"
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
  );
}
