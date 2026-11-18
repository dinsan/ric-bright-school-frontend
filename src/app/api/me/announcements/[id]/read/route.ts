import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { markAnnouncementRead } from "@/server/messages/announcements";
import { parseId } from "@/server/http/validation";
import { noContent, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

/** A parent marks an announcement read (204). */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent"]);
  await markAnnouncementRead(auth, parseId((await params).id, "That announcement"));
  return noContent();
});
