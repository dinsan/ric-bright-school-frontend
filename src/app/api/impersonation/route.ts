import type { NextRequest } from "next/server";
import { meFor } from "@/server/accounts/queries";
import { audit } from "@/server/audit";
import { clearSessionCookies, COOKIE, deleteSessionByToken, validateSessionToken, writeSessionCookies } from "@/server/auth/session";
import { HttpError } from "@/server/http/errors";
import { isSecureRequest } from "@/server/http/request";
import { json, route, toErrorResponse } from "@/server/http/route";

/** Stops an impersonation: ends the borrowed session and restores the admin's own. */
export const DELETE = route(async (request: NextRequest) => {
  const adminToken = request.cookies.get(COOKIE.impersonator)?.value;
  if (!adminToken) throw new HttpError(409, "not_impersonating", "You are not viewing as someone else.");

  const borrowedToken = request.cookies.get(COOKIE.session)?.value;
  const borrowed = borrowedToken ? await validateSessionToken(borrowedToken) : null;
  if (borrowedToken) await deleteSessionByToken(borrowedToken);

  const admin = await validateSessionToken(adminToken);
  if (!admin || admin.user.role !== "admin") {
    const ended = toErrorResponse(new HttpError(401, "session_ended", "Your admin session has ended. Sign in again."));
    clearSessionCookies(ended.cookies);
    return ended;
  }
  if (borrowed?.session.impersonatorId === admin.user.id) {
    await audit(request, { actorId: admin.user.id, action: "admin.impersonation_stopped", targetUserId: borrowed.user.id });
  }
  const response = json({ user: await meFor(admin.user) });
  writeSessionCookies(response.cookies, adminToken, admin.user.role, isSecureRequest(request));
  response.cookies.delete(COOKIE.impersonator);
  return response;
});
