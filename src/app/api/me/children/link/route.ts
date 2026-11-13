import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { linkChild, linkChildInput } from "@/server/family/service";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const POST = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["parent"]);
  return json(await linkChild(auth, await parseBody(request, linkChildInput)));
});
