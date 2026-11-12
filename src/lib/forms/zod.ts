import { z } from "zod";
import { messages } from "./messages";

/**
 * Fallback messages for zod issues that have no message of their own. Passed to the resolver
 * by useZodForm, so zod's technical defaults ("Invalid input: expected string") never reach users.
 * A message set on the schema itself always wins.
 */
export const friendlyErrorMap: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.expected === "number" || issue.expected === "int") return messages.number;
      return messages.required();
    case "too_small": {
      const min = Number(issue.minimum);
      if (issue.origin === "string") return min <= 1 ? messages.required() : messages.tooShort(min);
      if (issue.origin === "number" || issue.origin === "int") return messages.numberAtLeast(min);
      if (issue.origin === "array" || issue.origin === "set") return messages.chooseAtLeast(min);
      return messages.check;
    }
    case "too_big": {
      const max = Number(issue.maximum);
      if (issue.origin === "string") return messages.tooLong(max);
      if (issue.origin === "number" || issue.origin === "int") return messages.numberAtMost(max);
      if (issue.origin === "array" || issue.origin === "set") return messages.chooseAtMost(max);
      return messages.check;
    }
    case "invalid_format":
      return issue.format === "email" ? messages.email : messages.check;
    case "invalid_value":
      return messages.choose();
    case "not_multiple_of":
      return messages.wholeNumber;
    default:
      return messages.check;
  }
};

/**
 * Schema building blocks with good messages built in. `what` completes the sentence:
 * fields.text("your name") -> "Enter your name."
 */
export const fields = {
  text: (what: string, { min = 1, max = 200 }: { min?: number; max?: number } = {}) =>
    z
      .string()
      .trim()
      // abort: an empty box only says "Enter ...", not also "Use at least N characters".
      .min(1, { error: messages.required(what), abort: true })
      .min(min, messages.tooShort(min))
      .max(max, messages.tooLong(max)),

  /** Optional text: an empty box becomes undefined. */
  optionalText: ({ max = 2000 }: { max?: number } = {}) =>
    z
      .string()
      .trim()
      .max(max, messages.tooLong(max))
      .transform((value) => value || undefined),

  email: (what = "your email address") =>
    z
      .string()
      .trim()
      .min(1, { error: messages.required(what), abort: true })
      .pipe(z.email(messages.email)),

  /** One value from a list (select or radio group). Empty selection counts as missing. */
  choice: <const T extends readonly [string, ...string[]]>(values: T, what: string) =>
    z.enum(values, { error: messages.choose(what) }),

  /** A checkbox that must be ticked, for example to agree to the rules. Starts unticked (false). */
  accept: (what: string) =>
    z.boolean({ error: messages.accept(what) }).refine((ticked) => ticked, { error: messages.accept(what) }),

  /** A whole number typed into an <Input type="number"> registered with valueAsNumber. */
  wholeNumber: (what: string, { min, max }: { min?: number; max?: number } = {}) => {
    let schema = z.number({ error: messages.required(what) }).int(messages.wholeNumber);
    if (min !== undefined) schema = schema.min(min, messages.numberAtLeast(min));
    if (max !== undefined) schema = schema.max(max, messages.numberAtMost(max));
    return schema;
  },
};
