import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { lessonView } from "@/server/learning/service";
import { parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ lessonId: string }>;

/** The lesson player's data: lesson, content (once the course is started), outline, previous / next, video positions. */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await lessonView(auth, parseId((await params).lessonId, "That lesson")));
});
