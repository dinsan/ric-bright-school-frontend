import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { messageCreateInput, sendMessage } from "@/server/messages/service";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

/** Sends a message (201). Everyone in the conversation hears about it at once (GET /api/me/events). */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent", "teacher"]);
  return json(await sendMessage(auth, parseId((await params).id, "That conversation"), await parseBody(request, messageCreateInput)), 201);
});
