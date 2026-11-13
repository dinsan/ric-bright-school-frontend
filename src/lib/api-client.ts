type QueryValue = string | number | boolean | null | undefined;

export interface ApiFetchOptions extends Omit<RequestInit, "body" | "headers"> {
  headers?: Record<string, string>;
  /** Query-string parameters; null/undefined/empty values are dropped. */
  searchParams?: Record<string, QueryValue>;
  /** JSON request body. */
  json?: unknown;
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ field?: string; message?: string }>;
    request_id?: string | null;
  };
}

/** Mirrors the API's error envelope: `{ error: { code, message, details, request_id } }` (src/server/http). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Array<{ field?: string; message?: string }>;
  readonly requestId: string | null;

  constructor(status: number, envelope: ErrorEnvelope["error"], fallbackMessage: string) {
    super(envelope?.message ?? fallbackMessage);
    this.name = "ApiError";
    this.status = status;
    this.code = envelope?.code ?? "unknown_error";
    this.details = envelope?.details ?? [];
    this.requestId = envelope?.request_id ?? null;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let envelope: ErrorEnvelope["error"];
    try {
      envelope = ((await response.json()) as ErrorEnvelope).error;
    } catch {
      envelope = undefined;
    }
    return new ApiError(response.status, envelope, `Request failed with status ${response.status}`);
  }
}

/** Where this app's API lives: same origin, so the session cookie goes along and no CORS is involved. */
export const API_BASE = "/api";

/**
 * Calls this app's API (Route Handlers under src/app/api) from the browser. `path` is a contract path
 * such as "/me" or "/courses". The `X-Requested-With` header is part of the CSRF protection: the API
 * refuses state-changing requests without it (src/server/http/request.ts).
 *
 * Server Components don't use this: they call the services in src/server directly, without HTTP.
 */
export async function apiFetch<T>(path: string, { searchParams, json, headers, ...init }: ApiFetchOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      "X-Requested-With": "lumina",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  if (!response.ok) throw await ApiError.fromResponse(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
