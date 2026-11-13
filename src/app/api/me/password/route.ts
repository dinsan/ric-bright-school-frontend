import type { NextRequest } from "next/server";
import { changePassword, passwordChangeInput } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const POST = route(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await changePassword(auth, await parseBody(request, passwordChangeInput), request);
  return json({ password_changed: true });
});
