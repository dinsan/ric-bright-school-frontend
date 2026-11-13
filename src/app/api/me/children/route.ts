import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { addChild, childCreateInput, listChildren } from "@/server/family/service";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const GET = route(async (request: NextRequest) => json(await listChildren(await requireAuth(request, ["parent"]))));

export const POST = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["parent"]);
  return json(await addChild(auth, await parseBody(request, childCreateInput)), 201);
});
