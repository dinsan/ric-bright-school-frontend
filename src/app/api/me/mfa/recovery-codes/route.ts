import type { NextRequest } from "next/server";
import { codeInput, regenerateRecoveryCodes } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const POST = route(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  return json(await regenerateRecoveryCodes(auth, await parseBody(request, codeInput)));
});
