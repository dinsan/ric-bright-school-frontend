import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { deleteChild } from "@/server/family/service";
import { parseId } from "@/server/http/validation";
import { noContent, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

export const DELETE = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent"]);
  await deleteChild(auth, parseId((await params).id, "That child"), request);
  return noContent();
});
