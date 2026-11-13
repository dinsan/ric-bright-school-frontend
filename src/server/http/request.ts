import "server-only";

import type { NextRequest } from "next/server";
import { serverConfig } from "@/server/config";

/**
 * The client's IP address, from the reverse proxy's X-Forwarded-For (first entry) or X-Real-IP.
 * Run the app behind a proxy that sets these (any load balancer, Vercel, Docker ingress); used for
 * rate limits and the "where you're signed in" list, never for access decisions.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip")) ?? null;
}

export function userAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 512) ?? null;
}

/**
 * The site's public origin, for URLs sent to the browser and in emails (redirects, OAuth callback, links).
 * Not request.url: the standalone server (Docker) reports the address it listens on (0.0.0.0).
 * APP_URL wins when set (recommended in production); otherwise the (forwarded) Host header.
 */
export function publicOrigin(request: Request | NextRequest): string {
  const configured = serverConfig().APP_URL;
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/** Secure cookies on HTTPS (also behind a TLS-terminating proxy); plain HTTP for local development. */
export function isSecureRequest(request: Request | NextRequest): boolean {
  const forced = serverConfig().COOKIE_SECURE;
  if (forced) return forced === "true";
  const forwarded = request.headers.get("x-forwarded-proto");
  return (forwarded ?? new URL(request.url).protocol.replace(":", "")) === "https";
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF: state-changing requests must come from this site. Session cookies are SameSite=Lax; on top of
 * that the Origin (or Referer) must match the Host, and the app's own header must be present (which a
 * cross-site form can't send, and a cross-site fetch can't send without a CORS preflight this app refuses).
 */
export function isSameSite(request: Request): boolean {
  if (!MUTATING.has(request.method)) return true;
  if (request.headers.get("x-requested-with") !== "lumina") return false;
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
