import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { bookmarkCreateInput, createBookmark } from "@/server/learning/notes";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ lessonId: string }>;

/** Bookmarks the lesson, a part of it, or a moment in a video (201, or 200 when it already exists). */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  const lessonId = parseId((await params).lessonId, "That lesson");
  const { bookmark, created } = await createBookmark(auth, lessonId, await parseBody(request, bookmarkCreateInput));
  return json(bookmark, created ? 201 : 200);
});
