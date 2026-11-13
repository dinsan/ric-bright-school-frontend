import { resetInput, resetPassword } from "@/server/auth/service";
import { clearSessionCookies } from "@/server/auth/session";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const POST = route(async (request) => {
  await resetPassword(await parseBody(request, resetInput));
  // Every session of the account ended, including one this browser might have had.
  const response = json({ password_reset: true });
  clearSessionCookies(response.cookies);
  return response;
});
