"use client";

import { CircleExclamationPoint } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FieldContext, withFormError } from "./field-context";
import { Label } from "./label";

export interface FormFieldProps {
  label: ReactNode;
  /** Exactly one control: Input, Textarea or Select. */
  children: ReactNode;
  /** Help shown under the label, before the user types. */
  hint?: ReactNode;
  /** Error text. Inside a <Form>, leave it out and pass `name`: the error is read from the form. */
  error?: string;
  /** react-hook-form field name, used to read the field's error from the surrounding <Form>. */
  name?: string;
  /** Announce the control as required to assistive technology. Validation itself comes from the form schema. */
  required?: boolean;
  /** Add "(optional)" to the label. In forms where most fields are required, mark the few optional ones. */
  optional?: boolean;
  /** Hide the label visually (it is still announced). Only when the purpose is obvious from context. */
  hideLabel?: boolean;
  className?: string;
  id?: string;
}

/**
 * Label, hint, control and error, wired together for assistive technology:
 * the label targets the control, and the hint and error are announced with it.
 * Inside a <Form>, pass `name` and the error is read from the form.
 */
export const FormField = withFormError(FieldLayout);

function FieldLayout({ label, children, hint, error, required = false, optional, hideLabel, className, id }: FormFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <FieldContext.Provider value={{ id: fieldId, hintId, errorId, invalid: Boolean(error), required }}>
      <div className={cn("grid min-w-0 gap-1.5", className)}>
        <Label htmlFor={fieldId} optional={optional} className={cn(hideLabel && "sr-only")}>
          {label}
        </Label>
        {hint && (
          <p id={hintId} className="-mt-0.5 text-small text-fg-muted">
            {hint}
          </p>
        )}
        {children}
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    </FieldContext.Provider>
  );
}

/** Error text with an icon, so the state does not depend on colour alone. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-small font-bold text-danger-text">
      <CircleExclamationPoint aria-hidden className="mt-0.5 size-[1.1em] shrink-0" />
      <span>{children}</span>
    </p>
  );
}
