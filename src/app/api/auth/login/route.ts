import { login, loginInput } from "@/server/auth/service";
import { signInResponse } from "@/server/auth/sign-in";
import { parseBody } from "@/server/http/validation";
import { route } from "@/server/http/route";

/** Email + password: `{signed_in, user}` with the session cookie, or `{mfa_required}` with the MFA step cookie. */
export const POST = route(async (request) => signInResponse(request, await login(await parseBody(request, loginInput), request)));
