import { loginWithPictures, pictureLoginInput } from "@/server/auth/service";
import { signInResponse } from "@/server/auth/sign-in";
import { parseBody } from "@/server/http/validation";
import { route } from "@/server/http/route";

export const POST = route(async (request) => signInResponse(request, await loginWithPictures(await parseBody(request, pictureLoginInput), request)));
