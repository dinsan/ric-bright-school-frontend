import { NextResponse, type NextRequest } from "next/server";
import { paths } from "@/features/auth/contract";
import { callBackend, errorResponse, isSameSite } from "@/lib/server/bff";
import { clearSession, COOKIE } from "@/lib/server/session";

/** Signs out: ends the session on the backend (best effort) and always clears the cookies. */
export async function POST(request: NextRequest) {
  if (!isSameSite(request)) return errorResponse(403, "cross_site_request", "This request must come from the Lumina site.");
  const refreshToken = request.cookies.get(COOKIE.refresh)?.value;
  if (refreshToken || request.cookies.has(COOKIE.access)) {
    await callBackend(request, {
      path: paths.logout,
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken ?? null }),
      contentType: "application/json",
    }).catch(() => null);
  }
  const result = new NextResponse(null, { status: 204 });
  clearSession(result.cookies);
  return result;
}
