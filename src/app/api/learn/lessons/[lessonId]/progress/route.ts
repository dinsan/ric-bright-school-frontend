import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { lessonProgressInput, recordLessonProgress } from "@/server/learning/service";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ lessonId: string }>;

/** A progress report from the lesson player: idempotent, safe to retry (see the service). */
export const PUT = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  const lessonId = parseId((await params).lessonId, "That lesson");
  return json(await recordLessonProgress(auth, lessonId, await parseBody(request, lessonProgressInput)));
});
