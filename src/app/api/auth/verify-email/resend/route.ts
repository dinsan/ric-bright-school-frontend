import { emailInput, resendVerification } from "@/server/auth/service";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const POST = route(async (request) => {
  await resendVerification(await parseBody(request, emailInput), request);
  return json({ status: "sent_if_needed" }, 202);
});
