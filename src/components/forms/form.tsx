"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import {
  FormProvider,
  useForm,
  useFormState,
  type FieldValues,
  type Path,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { fieldPaths, mapServerErrors } from "@/lib/forms/server-errors";
import { friendlyErrorMap } from "@/lib/forms/zod";

type AnySchema = z.ZodType<FieldValues, FieldValues>;

/**
 * react-hook-form set up the Lumina way: zod validation with friendly messages. Errors appear when
 * the form is submitted, then update live while the user fixes them. Not on leaving a field: an
 * error appearing on blur pushes the content below it down, so a click on the next button misses
 * (and early errors are stressful for young learners). GOV.UK Design System guidance agrees.
 */
export function useZodForm<TSchema extends AnySchema>(
  schema: TSchema,
  options: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, "resolver"> = {},
) {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    ...options,
    resolver: zodResolver(schema, { error: friendlyErrorMap }),
  });
}

export interface FormProps<TValues extends FieldValues, TOutput> extends Omit<ComponentProps<"form">, "onSubmit"> {
  form: UseFormReturn<TValues, unknown, TOutput>;
  /**
   * Called with valid values. Throw (for example the ApiError from the API client) to show the
   * problem: `details[].field` errors go to the matching fields, anything else above the form.
   */
  onSubmit: (values: TOutput) => unknown;
  children: ReactNode;
}

export function Form<TValues extends FieldValues, TOutput>({ form, onSubmit, children, className, ...props }: FormProps<TValues, TOutput>) {
  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      const { fieldErrors, formError } = mapServerErrors(error, fieldPaths(form.getValues()));
      fieldErrors.forEach(({ name, message }, index) =>
        form.setError(name as Path<TValues>, { type: "server", message }, { shouldFocus: index === 0 }),
      );
      if (formError) form.setError("root.server", { type: "server", message: formError });
    }
  });

  return (
    <FormProvider {...form}>
      {/* noValidate: the browser's own bubbles are replaced by our accessible messages.
          method="post": if someone submits before the page has finished loading its JavaScript,
          the browser's own submit must not put the fields (passwords!) in the URL, history and logs. */}
      <form noValidate method="post" onSubmit={submit} className={cn("grid gap-stack", className)} {...props}>
        {children}
      </form>
    </FormProvider>
  );
}

/**
 * The form-level error (server down, rate limited, errors not tied to a field). Place it at the
 * top of the form. It takes focus when it appears so keyboard and screen reader users notice.
 */
export function FormErrorSummary({ title = "That did not go through" }: { title?: string }) {
  const { errors } = useFormState();
  const message = errors.root?.server?.message;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  if (!message) return null;
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <Alert tone="danger" role="alert" title={title}>
        {message}
      </Alert>
    </div>
  );
}

/** The submit button: shows a spinner and blocks double submits while the form is sending. */
export function SubmitButton({ children, variant = "primary", ...props }: Omit<ButtonProps, "type">) {
  const { isSubmitting } = useFormState();
  return (
    <Button type="submit" variant={variant} loading={isSubmitting} {...props}>
      {children}
    </Button>
  );
}
