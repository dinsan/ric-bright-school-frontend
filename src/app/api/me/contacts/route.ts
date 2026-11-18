import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { contacts } from "@/server/messages/service";
import { json, route } from "@/server/http/route";

/** Who the reader can start a conversation with: a parent's children and their teachers; a teacher's classes and pupils. */
export const GET = route(async (request: NextRequest) => json(await contacts(await requireAuth(request, ["parent", "teacher"]))));
