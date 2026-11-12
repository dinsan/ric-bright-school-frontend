"use client";

import { createContext, useContext, type ComponentType } from "react";
import { get, useFormContext, useFormState, type FieldError as RhfFieldError } from "react-hook-form";

/** Ids and state a FormField shares with the control inside it. */
export interface FieldContextValue {
  id: string;
  hintId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

interface ControlA11yProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  required?: boolean;
}

/**
 * Wires a control to its FormField: id (so the label points at it), aria-describedby (hint and
 * error), aria-invalid and required. Props passed directly to the control win.
 */
export function useFieldControl<P extends ControlA11yProps>(props: P): P {
  const field = useContext(FieldContext);
  if (!field) return props;
  const describedBy = [field.hintId, field.errorId, props["aria-describedby"]].filter(Boolean).join(" ");
  return {
    ...props,
    id: props.id ?? field.id,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    required: props.required ?? (field.required || undefined),
  };
}

/**
 * Lets a field component read its error from the surrounding react-hook-form <Form>, by `name`,
 * when no `error` prop is passed. Outside a form the component works as usual.
 */
export function withFormError<P extends { name?: string; error?: string }>(View: ComponentType<P>) {
  function Connected(props: P & { name: string }) {
    const { errors } = useFormState({ name: props.name });
    const fieldError = get(errors, props.name) as RhfFieldError | undefined;
    return <View {...props} error={props.error ?? fieldError?.message} />;
  }
  function FieldWithFormError(props: P) {
    const form = useFormContext();
    return form && props.name ? <Connected {...props} name={props.name} /> : <View {...props} />;
  }
  FieldWithFormError.displayName = `WithFormError(${View.displayName ?? View.name})`;
  return FieldWithFormError;
}
