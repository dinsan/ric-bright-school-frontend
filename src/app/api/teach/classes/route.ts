import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { listClasses } from "@/server/teaching/service";
import { json, route } from "@/server/http/route";

/** The teacher's classes (verified teachers). */
export const GET = route(async (request: NextRequest) => json(await listClasses(await requireAuth(request, ["teacher"]))));
