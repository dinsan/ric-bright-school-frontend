import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { unreadCounts } from "@/server/messages/service";
import { json, route } from "@/server/http/route";

/** The menu badge: unread messages and (parents) unread announcements. */
export const GET = route(async (request: NextRequest) => json(await unreadCounts(await requireAuth(request, ["parent", "teacher"]))));
