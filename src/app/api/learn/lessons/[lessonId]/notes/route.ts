import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { createNote, noteCreateInput } from "@/server/learning/notes";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ lessonId: string }>;

/** Writes a note in a lesson (about the lesson, or one part of it). */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  const lessonId = parseId((await params).lessonId, "That lesson");
  return json(await createNote(auth, lessonId, await parseBody(request, noteCreateInput)), 201);
});
