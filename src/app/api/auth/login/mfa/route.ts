import type { NextRequest } from "next/server";
import { completeMfa, mfaInput } from "@/server/auth/service";
import { COOKIE } from "@/server/auth/session";
import { signInResponse } from "@/server/auth/sign-in";
import { parseBody } from "@/server/http/validation";
import { route } from "@/server/http/route";

/** The MFA step: the code from the body, the step itself from the httpOnly cookie set at /auth/login. */
export const POST = route(async (request: NextRequest) => {
  const input = await parseBody(request, mfaInput);
  return signInResponse(request, await completeMfa(input, request.cookies.get(COOKIE.mfa)?.value, request));
});
