import type { NextRequest } from "next/server";
import { getUser, updateUser, userUpdateInput } from "@/server/admin/service";
import { requireAuth } from "@/server/auth/context";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

export const GET = route(async (request: NextRequest, { params }: Context) => {
  await requireAuth(request, ["admin"]);
  return json(await getUser(parseId((await params).id, "That user")));
});

export const PATCH = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["admin"]);
  const id = parseId((await params).id, "That user");
  return json(await updateUser(auth, id, await parseBody(request, userUpdateInput), request));
});
