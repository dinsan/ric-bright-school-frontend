import type { NextRequest } from "next/server";
import { emailChangeInput, requestEmailChange } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const POST = route(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await requestEmailChange(auth, await parseBody(request, emailChangeInput), request);
  return json({ status: "confirmation_sent" }, 202);
});
