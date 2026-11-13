import type { NextRequest } from "next/server";
import { codeInput, disableTotp, startTotp } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { parseBody } from "@/server/http/validation";
import { json, noContent, route } from "@/server/http/route";

/** Starts the setup: a new secret for the authenticator app (confirmed by /me/mfa/totp/confirm). */
export const POST = route(async (request: NextRequest) => json(await startTotp(await requireAuth(request))));

/** Turns two-step verification off; needs a current code. */
export const DELETE = route(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await disableTotp(auth, await parseBody(request, codeInput), request);
  return noContent();
});
