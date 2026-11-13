import { tokenInput, verifyEmail } from "@/server/auth/service";
import { signInResponse } from "@/server/auth/sign-in";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const POST = route(async (request) => {
  const outcome = await verifyEmail(await parseBody(request, tokenInput), request);
  return outcome ? signInResponse(request, outcome) : json({ verified: true });
});
