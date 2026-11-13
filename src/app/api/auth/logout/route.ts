import type { NextRequest } from "next/server";
import { clearSessionCookies, COOKIE, deleteSessionByToken } from "@/server/auth/session";
import { noContent, route } from "@/server/http/route";

/** Signs out: ends this session (and a borrowed admin session, if any) and always clears the cookies. */
export const POST = route(async (request: NextRequest) => {
  for (const name of [COOKIE.session, COOKIE.impersonator]) {
    const token = request.cookies.get(name)?.value;
    if (token) await deleteSessionByToken(token);
  }
  const response = noContent();
  clearSessionCookies(response.cookies);
  return response;
});
