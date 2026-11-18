import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { deleteBookmark } from "@/server/learning/notes";
import { parseId } from "@/server/http/validation";
import { noContent, type Params, route } from "@/server/http/route";

type Context = Params<{ bookmarkId: string }>;

export const DELETE = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  await deleteBookmark(auth, parseId((await params).bookmarkId, "That bookmark"));
  return noContent();
});
