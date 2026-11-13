import type { NextRequest } from "next/server";
import { listSessions } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { json, route } from "@/server/http/route";

export const GET = route(async (request: NextRequest) => json(await listSessions(await requireAuth(request))));
