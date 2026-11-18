import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { markConversationRead } from "@/server/messages/service";
import { parseId } from "@/server/http/validation";
import { noContent, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

/** Marks the conversation read up to now (204). */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent", "teacher"]);
  await markConversationRead(auth, parseId((await params).id, "That conversation"));
  return noContent();
});
