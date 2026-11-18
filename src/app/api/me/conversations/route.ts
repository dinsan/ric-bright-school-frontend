import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { conversationOpenInput, listConversations, openConversation } from "@/server/messages/service";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

const roles = ["parent", "teacher"] as const;

/** GET: the reader's conversations, latest first, with unread counts. POST: open (or find) the one about a child. */
export const GET = route(async (request: NextRequest) => json(await listConversations(await requireAuth(request, [...roles]))));

export const POST = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, [...roles]);
  const { id, created } = await openConversation(auth, await parseBody(request, conversationOpenInput));
  return json({ id }, created ? 201 : 200);
});
