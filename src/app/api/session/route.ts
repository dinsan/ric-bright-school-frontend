import type { NextRequest } from "next/server";
import type { SessionPayload } from "@/features/auth/contract";
import { meFor } from "@/server/accounts/queries";
import { getAuth } from "@/server/auth/context";
import { clearSessionCookies, COOKIE } from "@/server/auth/session";
import { json, route } from "@/server/http/route";

/** Who is signed in, for the browser. Clears stale cookies when the session has ended. */
export const GET = route(async (request: NextRequest) => {
  const auth = await getAuth(request);
  const response = json<SessionPayload>({
    user: auth ? await meFor(auth.user) : null,
    impersonating: auth?.session.kind === "impersonation",
  });
  if (!auth && request.cookies.has(COOKIE.session)) clearSessionCookies(response.cookies);
  return response;
});
