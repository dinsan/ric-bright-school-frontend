import { apiFetch, type ApiFetchOptions } from "@/lib/api-client";

/**
 * Calls the backend through this site's gateway (/api/...), which adds the signed-in user's
 * session from httpOnly cookies. Use it for everything that needs an account. Browser only.
 * The header tells the gateway the request comes from this app (part of the CSRF protection).
 */
export function bff<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    baseUrl: "/api",
    credentials: "same-origin",
    headers: { "X-Requested-With": "lumina", ...options.headers },
  });
}
