import { NextResponse, type NextRequest } from "next/server";
import { paths } from "@/features/auth/contract";
import { callBackend, errorResponse, isSameSite } from "@/lib/server/bff";
import { clearSession, COOKIE, fetchMe, isSecureRequest, refreshTokens, writeSession } from "@/lib/server/session";

/** Stops an impersonation: ends the borrowed session and restores the admin's own. */
export async function DELETE(request: NextRequest) {
  if (!isSameSite(request)) return errorResponse(403, "cross_site_request", "This request must come from the Lumina site.");
  const adminRefresh = request.cookies.get(COOKIE.impersonator)?.value;
  if (!adminRefresh) return errorResponse(409, "not_impersonating", "You are not viewing as someone else.");

  await callBackend(request, {
    path: paths.logout,
    method: "POST",
    body: JSON.stringify({ refresh_token: request.cookies.get(COOKIE.refresh)?.value ?? null }),
    contentType: "application/json",
  }).catch(() => null);

  const refreshed = await refreshTokens(adminRefresh);
  const tokens = refreshed.status === "ok" ? refreshed.tokens : null;
  const admin = tokens ? await fetchMe(tokens.access_token) : null;
  if (!tokens || !admin) {
    const ended = errorResponse(401, "session_ended", "Your admin session has ended. Sign in again.");
    clearSession(ended.cookies);
    return ended;
  }
  const result = NextResponse.json({ user: admin });
  writeSession(result.cookies, tokens, admin.role, isSecureRequest(request));
  result.cookies.delete(COOKIE.impersonator);
  return result;
}
