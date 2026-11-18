import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { conversationQuery, conversationView } from "@/server/messages/service";
import { parseId, parseQuery } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

/** A conversation: people, latest messages (?before=… for older ones), the child's work set by the teacher. */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent", "teacher"]);
  return json(await conversationView(auth, parseId((await params).id, "That conversation"), parseQuery(request, conversationQuery)));
});
