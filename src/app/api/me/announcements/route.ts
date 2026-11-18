import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { announcementCreateInput, createAnnouncement, listAnnouncements } from "@/server/messages/announcements";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

/** GET: announcements (a teacher's own with how many read them; a parent's to read). POST: a teacher posts one (201). */
export const GET = route(async (request: NextRequest) => json(await listAnnouncements(await requireAuth(request, ["parent", "teacher"]))));

export const POST = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["teacher"]);
  return json(await createAnnouncement(auth, await parseBody(request, announcementCreateInput)), 201);
});
