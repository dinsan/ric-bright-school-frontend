import "server-only";

import { z } from "zod";
import { friendlyErrorMap } from "@/lib/forms/zod";
import { HttpError, type ErrorDetail } from "./errors";

/** Largest JSON body accepted (bytes). Every request in this API is a small form. */
const MAX_BODY_BYTES = 64 * 1024;

function toDetails(location: "body" | "query" | "path", error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: [location, ...issue.path.map(String)].join("."),
    message: issue.message,
  }));
}

export function validationError(location: "body" | "query" | "path", error: z.ZodError) {
  return new HttpError(422, "validation_error", "Check the highlighted answers.", { details: toDetails(location, error) });
}

/** Reads and validates a JSON body. An empty body counts as {}. Messages come from the shared form messages. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new HttpError(413, "payload_too_large", "That request is too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "payload_too_large", "That request is too large.");
  let data: unknown = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new HttpError(400, "invalid_json", "The request body is not valid JSON.");
    }
  }
  const result = schema.safeParse(data, { error: friendlyErrorMap });
  if (!result.success) throw validationError("body", result.error);
  return result.data;
}

/** Validates query-string parameters (each one a string; use z.coerce for numbers). */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.output<S> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) if (value !== "") params[key] = value;
  const result = schema.safeParse(params, { error: friendlyErrorMap });
  if (!result.success) throw validationError("query", result.error);
  return result.data;
}

/** A UUID path parameter; anything else is simply "not found". */
export function parseId(value: string, what = "That"): string {
  if (!z.uuid().safeParse(value).success) throw new HttpError(404, "not_found", `${what} was not found.`);
  return value;
}
