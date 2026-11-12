import { NextResponse, type NextRequest } from "next/server";
import { paths, type Me } from "@/features/auth/contract";
import { callBackend } from "@/lib/server/bff";
import { clearSession, COOKIE, isSecureRequest, writeSession } from "@/lib/server/session";

export interface SessionPayload {
  user: Me | null;
  /** An admin is viewing the app as this user (support impersonation). */
  impersonating: boolean;
}

/** Who is signed in, for the browser. Never includes tokens. */
export async function GET(request: NextRequest) {
  const hasSession = request.cookies.has(COOKIE.access) || request.cookies.has(COOKIE.refresh);
  if (!hasSession) return NextResponse.json<SessionPayload>({ user: null, impersonating: false });

  const { response, refreshed, sessionEnded } = await callBackend(request, { path: paths.me });
  const user = response.ok ? ((await response.json()) as Me) : null;
  const result = NextResponse.json<SessionPayload>({ user, impersonating: Boolean(user) && request.cookies.has(COOKIE.impersonator) });
  result.headers.set("cache-control", "no-store");
  if (refreshed && user) writeSession(result.cookies, refreshed, user.role, isSecureRequest(request));
  if (sessionEnded || (!user && response.status === 401)) clearSession(result.cookies);
  return result;
}
