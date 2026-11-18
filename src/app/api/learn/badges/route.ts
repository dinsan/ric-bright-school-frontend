import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { listBadges } from "@/server/learning/service";
import { json, route } from "@/server/http/route";

/** The badge shelf: every badge, with `earned_at` for the ones the student has. */
export const GET = route(async (request: NextRequest) => json(await listBadges(await requireAuth(request, ["student"]))));
