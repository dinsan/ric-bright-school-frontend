import "server-only";

/**
 * Errors a service can throw to answer the browser. The route wrapper (./route.ts) turns them into the
 * error envelope every client understands: { error: { code, message, details, request_id } }.
 * `details[].field` ("body.email") puts the message next to that form field (lib/forms/server-errors.ts).
 */

export interface ErrorDetail {
  field?: string;
  message: string;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];
  readonly headers: Record<string, string>;

  constructor(status: number, code: string, message: string, { details = [], headers = {} }: { details?: ErrorDetail[]; headers?: Record<string, string> } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

/** An error about one field of the request body. */
export function fieldError(field: string, message: string, { status = 400, code = "invalid_input" }: { status?: number; code?: string } = {}) {
  return new HttpError(status, code, message, { details: [{ field: `body.${field}`, message }] });
}

export const notAuthenticated = () => new HttpError(401, "not_authenticated", "Sign in to continue.");
export const forbidden = (message = "You can't do that with this account.") => new HttpError(403, "forbidden", message);
export const notFound = (what = "That") => new HttpError(404, "not_found", `${what} was not found.`);
export const tooManyRequests = (retryAfterSeconds: number, message = "That was a lot of tries in a short time. Wait a minute, then try again.") =>
  new HttpError(429, "too_many_requests", message, { headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))) } });
