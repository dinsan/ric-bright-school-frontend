import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { reviewOverview } from "@/server/learning/review";
import { json, route } from "@/server/http/route";

/** What there is to review: due now, in all, per course, and when the next question comes due. */
export const GET = route(async (request: NextRequest) => json(await reviewOverview(await requireAuth(request, ["student"]))));
