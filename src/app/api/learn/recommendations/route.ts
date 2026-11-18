import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { recommendations } from "@/server/learning/paths";
import { json, route } from "@/server/http/route";

/** A few courses worth starting next, each with its reason. */
export const GET = route(async (request: NextRequest) => json(await recommendations(await requireAuth(request, ["student"]))));
