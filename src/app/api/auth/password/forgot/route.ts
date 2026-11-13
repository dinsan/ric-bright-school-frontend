import { emailInput, forgotPassword } from "@/server/auth/service";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

/** Always the same answer: it never reveals whether an address has an account. */
export const POST = route(async (request) => {
  await forgotPassword(await parseBody(request, emailInput), request);
  return json({ status: "sent_if_exists" }, 202);
});
