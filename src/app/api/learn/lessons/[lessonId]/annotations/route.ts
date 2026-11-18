import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { lessonAnnotations } from "@/server/learning/notes";
import { parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ lessonId: string }>;

/** The student's notes and bookmarks in one lesson. */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await lessonAnnotations(auth, parseId((await params).lessonId, "That lesson")));
});
