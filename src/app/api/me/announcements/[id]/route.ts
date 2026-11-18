import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { deleteAnnouncement } from "@/server/messages/announcements";
import { parseId } from "@/server/http/validation";
import { noContent, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

/** A teacher removes one of their announcements (204). */
export const DELETE = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["teacher"]);
  await deleteAnnouncement(auth, parseId((await params).id, "That announcement"));
  return noContent();
});
