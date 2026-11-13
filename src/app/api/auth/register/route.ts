import { register, registerInput } from "@/server/auth/service";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

/** Same answer whether or not the email already has an account (see the service). */
export const POST = route(async (request) => {
  await register(await parseBody(request, registerInput), request);
  return json({ status: "verification_sent" }, 202);
});
