import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { childProgress, progressQuery } from "@/server/family/progress";
import { parseId, parseQuery } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

/** One child's learning: courses, quiz results, work, learning time (?days=1–90, default 14), activity, insights. */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent"]);
  return json(await childProgress(auth, parseId((await params).id, "That child"), parseQuery(request, progressQuery)));
});
