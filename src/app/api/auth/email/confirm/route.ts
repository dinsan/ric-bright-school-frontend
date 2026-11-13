import { confirmEmailChange, tokenInput } from "@/server/auth/service";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const POST = route(async (request) => {
  await confirmEmailChange(await parseBody(request, tokenInput), request);
  return json({ email_changed: true });
});
