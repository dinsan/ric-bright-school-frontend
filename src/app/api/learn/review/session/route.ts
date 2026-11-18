import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { reviewSession, reviewSessionInput } from "@/server/learning/review";
import { parseQuery } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

/** The questions for a session: ?mode=review (due now) or ?mode=practice (weakest first), &course_id=… */
export const GET = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await reviewSession(auth, parseQuery(request, reviewSessionInput)));
});
