import { ApiError } from "@/lib/api-client";
import { messages } from "./messages";

export interface MappedServerErrors {
  /** Errors to show next to fields. */
  fieldErrors: Array<{ name: string; message: string }>;
  /** A message for the whole form, shown above it. */
  formError?: string;
}

// FastAPI reports where a value came from ("body.title", "query.grade_level"); forms only know "title".
const LOCATION_PREFIXES = new Set(["body", "query", "path", "header", "cookie"]);

/** "body.student.name" or "body[student][name]" -> "student.name". */
export function normaliseFieldPath(field: string): string {
  const parts = field.split(/[.[\]]+/).filter(Boolean);
  if (parts.length > 1 && LOCATION_PREFIXES.has(parts[0]!)) parts.shift();
  return parts.join(".");
}

/**
 * Turns an error thrown while submitting into field errors and a form-level message.
 * `details[].field` entries that match a form field are shown on that field; everything else
 * (unknown fields, errors without details, network failures) becomes the form-level message.
 */
export function mapServerErrors(error: unknown, fieldNames: readonly string[]): MappedServerErrors {
  if (!(error instanceof ApiError)) {
    // fetch() throws TypeError when the server cannot be reached.
    return { fieldErrors: [], formError: error instanceof TypeError ? messages.unreachable : messages.serverProblem };
  }
  if (error.status === 429) return { fieldErrors: [], formError: messages.tooManyRequests };
  if (error.status >= 500) return { fieldErrors: [], formError: messages.serverProblem };

  const known = new Set(fieldNames);
  const fieldErrors: MappedServerErrors["fieldErrors"] = [];
  const unmatched: string[] = [];
  for (const detail of error.details) {
    const name = detail.field ? normaliseFieldPath(detail.field) : "";
    const message = detail.message ?? messages.check;
    if (name && known.has(name)) {
      // One message per field is enough; later ones for the same field are dropped.
      if (!fieldErrors.some((item) => item.name === name)) fieldErrors.push({ name, message });
    } else {
      unmatched.push(message);
    }
  }
  const formError = unmatched.length > 0 ? unmatched.join(" ") : fieldErrors.length === 0 ? error.message : undefined;
  return { fieldErrors, formError };
}

/** Every field path in a values object: { a: 1, b: { c: 2 } } -> ["a", "b", "b.c"]. */
export function fieldPaths(values: unknown, prefix = ""): string[] {
  if (values === null || typeof values !== "object" || values instanceof Date || values instanceof File) return [];
  return Object.entries(values as Record<string, unknown>).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...fieldPaths(value, path)];
  });
}
