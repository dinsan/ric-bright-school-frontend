import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { childrenOverview } from "@/server/family/progress";
import { json, route } from "@/server/http/route";

/** The parent's dashboard: a card per child with their learning this week, latest quiz and work due. */
export const GET = route(async (request: NextRequest) => json(await childrenOverview(await requireAuth(request, ["parent"]))));
