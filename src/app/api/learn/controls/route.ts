import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { studentControls } from "@/server/family/controls";
import { json, route } from "@/server/http/route";

/** The student's own learning-time controls (set by a parent) and today's minutes, for the reminder or pause. */
export const GET = route(async (request: NextRequest) => json(await studentControls(await requireAuth(request, ["student"]))));
