import type { NextRequest } from "next/server";
import { endSession } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { clearSessionCookies } from "@/server/auth/session";
import { parseId } from "@/server/http/validation";
import { noContent, type Params, route } from "@/server/http/route";

export const DELETE = route(async (request: NextRequest, { params }: Params<{ id: string }>) => {
  const auth = await requireAuth(request);
  const id = parseId((await params).id, "That session");
  await endSession(auth, id);
  const response = noContent();
  if (id === auth.session.id) clearSessionCookies(response.cookies);
  return response;
});
