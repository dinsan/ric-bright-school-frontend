import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { unenroll } from "@/server/learning/service";
import { parseId } from "@/server/http/validation";
import { noContent, type Params, route } from "@/server/http/route";

type Context = Params<{ courseId: string }>;

/** Leave a course (progress is kept for a later return). */
export const DELETE = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  await unenroll(auth, parseId((await params).courseId, "That course"));
  return noContent();
});
