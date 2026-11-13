import type { NextRequest } from "next/server";
import type { SignInResult } from "@/features/auth/contract";
import { meFor } from "@/server/accounts/queries";
import { startImpersonation } from "@/server/admin/service";
import { requireAuth } from "@/server/auth/context";
import { IMPERSONATION_SESSION_SECONDS, writeImpersonatorCookie, writeSessionCookies } from "@/server/auth/session";
import { isSecureRequest } from "@/server/http/request";
import { parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

/**
 * Starts a support impersonation: the browser switches to a one-hour session as the user. The admin's
 * own session token is kept aside (httpOnly) so "Stop viewing" (DELETE /api/impersonation) returns to it.
 */
export const POST = route(async (request: NextRequest, { params }: Params<{ id: string }>) => {
  const auth = await requireAuth(request, ["admin"]);
  const { target, created } = await startImpersonation(auth, parseId((await params).id, "That user"), request);
  const response = json<SignInResult>({ signed_in: true, user: await meFor(target) });
  const secure = isSecureRequest(request);
  writeSessionCookies(response.cookies, created.token, target.role, secure, IMPERSONATION_SESSION_SECONDS);
  writeImpersonatorCookie(response.cookies, auth.token, secure);
  return response;
});
