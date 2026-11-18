import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { progressShareInput, shareProgress } from "@/server/messages/service";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

/** Shares a progress update (teacher: the child's work they set; parent: learning at home), with an optional note. */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent", "teacher"]);
  return json(await shareProgress(auth, parseId((await params).id, "That conversation"), await parseBody(request, progressShareInput)), 201);
});
