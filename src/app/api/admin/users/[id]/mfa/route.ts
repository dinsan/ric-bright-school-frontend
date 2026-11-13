import type { NextRequest } from "next/server";
import { resetMfa } from "@/server/admin/service";
import { requireAuth } from "@/server/auth/context";
import { parseId } from "@/server/http/validation";
import { noContent, type Params, route } from "@/server/http/route";

export const DELETE = route(async (request: NextRequest, { params }: Params<{ id: string }>) => {
  const auth = await requireAuth(request, ["admin"]);
  await resetMfa(auth, parseId((await params).id, "That user"), request);
  return noContent();
});
