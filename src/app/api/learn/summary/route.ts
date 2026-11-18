import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { learningSummary } from "@/server/learning/service";
import { json, route } from "@/server/http/route";

/** The student dashboard's numbers: streak, XP and level, lessons and courses done, minutes, "Continue". */
export const GET = route(async (request: NextRequest) => json(await learningSummary(await requireAuth(request, ["student"]))));
