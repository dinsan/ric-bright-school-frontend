import type { NextRequest } from "next/server";
import { paths } from "@/features/auth/contract";
import { callBackend, errorResponse, isSameSite, toBrowserResponse } from "@/lib/server/bff";
import { COOKIE, isSecureRequest } from "@/lib/server/session";

/**
 * Starts a support impersonation: the backend issues time-limited tokens for the user. The admin's
 * own refresh token is kept aside (httpOnly) so "Stop" can return to the admin session.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSite(request)) return errorResponse(403, "cross_site_request", "This request must come from the Lumina site.");
  if (request.cookies.has(COOKIE.impersonator)) {
    return errorResponse(409, "already_impersonating", "Stop the current impersonation first.");
  }
  const adminRefresh = request.cookies.get(COOKIE.refresh)?.value;
  const { id } = await params;
  const result = await callBackend(request, { path: paths.adminImpersonate(id), method: "POST", body: await request.text(), contentType: "application/json" });
  const response = await toBrowserResponse(request, result);
  if (result.response.ok && adminRefresh && response.cookies.get(COOKIE.access)) {
    response.cookies.set(COOKIE.impersonator, adminRefresh, {
      path: "/",
      sameSite: "lax",
      secure: isSecureRequest(request),
      httpOnly: true,
      maxAge: 60 * 60 * 8,
    });
  }
  return response;
}
