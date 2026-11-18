import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { studentAssignments } from "@/server/learning/assignments";
import { json, route } from "@/server/http/route";

/** Work set by the student's teachers, with the student's progress on each. */
export const GET = route(async (request: NextRequest) => json(await studentAssignments(await requireAuth(request, ["student"]))));
