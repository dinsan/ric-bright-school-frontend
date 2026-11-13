import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { setUpChildSignIn, signInSetupInput } from "@/server/family/service";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

export const PUT = route(async (request: NextRequest, { params }: Params<{ id: string }>) => {
  const auth = await requireAuth(request, ["parent"]);
  const childId = parseId((await params).id, "That child");
  return json(await setUpChildSignIn(auth, childId, await parseBody(request, signInSetupInput)));
});
