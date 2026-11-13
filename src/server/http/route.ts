import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { isDatabaseUnavailable } from "@/server/db";
import { HttpError } from "./errors";
import { isSameSite } from "./request";

/**
 * Wraps a Route Handler of this app's API:
 * - refuses cross-site state-changing requests (CSRF, see isSameSite);
 * - gives every request an id (X-Request-ID, echoed in errors so support can find the log line);
 * - turns thrown errors into the error envelope: HttpError as it is, an unreachable database as 503
 *   ("try again", never "signed out"), anything else as a logged 500 without internals;
 * - marks responses as not cacheable unless the handler says otherwise.
 */
type Handler<Context> = (request: NextRequest, context: Context) => Promise<Response> | Response;

export function errorEnvelope(status: number, code: string, message: string, { details = [], requestId = null, headers = {} }: { details?: unknown[]; requestId?: string | null; headers?: Record<string, string> } = {}) {
  return NextResponse.json({ error: { code, message, details, request_id: requestId } }, { status, headers });
}

export function route<Context = unknown>(handler: Handler<Context>) {
  return async (request: NextRequest, context: Context): Promise<Response> => {
    const requestId = request.headers.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
    let response: Response;
    try {
      if (!isSameSite(request)) {
        throw new HttpError(403, "cross_site_request", "This request must come from the Lumina site.");
      }
      response = await handler(request, context);
    } catch (error) {
      response = toErrorResponse(error, requestId);
    }
    response.headers.set("x-request-id", requestId);
    if (!response.headers.has("cache-control")) response.headers.set("cache-control", "no-store");
    return response;
  };
}

export function toErrorResponse(error: unknown, requestId: string | null = null): NextResponse {
  if (error instanceof HttpError) {
    return errorEnvelope(error.status, error.code, error.message, { details: error.details, requestId, headers: error.headers });
  }
  if (isDatabaseUnavailable(error)) {
    console.error(`[api] ${requestId} database unavailable`, error);
    return errorEnvelope(503, "service_unavailable", "Lumina can't reach its database right now. Try again in a moment.", {
      requestId,
      headers: { "retry-after": "30" },
    });
  }
  console.error(`[api] ${requestId} unexpected error`, error);
  return errorEnvelope(500, "internal_error", "Something went wrong on our side. Try again in a moment.", { requestId });
}

/** JSON response helper with an optional status. */
export function json<T>(data: T, init?: number | ResponseInit): NextResponse<T> {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/** The context of a dynamic route: `Params<{ id: string }>` for app/api/…/[id]/route.ts. */
export type Params<T extends Record<string, string>> = { params: Promise<T> };
