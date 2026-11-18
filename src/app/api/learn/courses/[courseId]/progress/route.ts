import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { courseProgress } from "@/server/learning/service";
import { parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ courseId: string }>;

/** The course outline with the student's status per lesson, and where "Continue" goes. */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await courseProgress(auth, parseId((await params).courseId, "That course")));
});
