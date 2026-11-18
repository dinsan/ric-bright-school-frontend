import type { NextRequest } from "next/server";
import { parentalControlsInput } from "@/features/learn/controls";
import { requireAuth } from "@/server/auth/context";
import { childControls, updateChildControls } from "@/server/family/controls";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

/** GET: the child's parental controls. PUT: set them (the whole set). */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent"]);
  return json(await childControls(auth, parseId((await params).id, "That child")));
});

export const PUT = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent"]);
  return json(await updateChildControls(auth, parseId((await params).id, "That child"), await parseBody(request, parentalControlsInput)));
});
