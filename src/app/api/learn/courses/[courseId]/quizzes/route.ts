import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { courseQuizzes } from "@/server/learning/quizzes";
import { parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ courseId: string }>;

/** The course's quizzes, with the student's attempt in progress and last result on each. */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await courseQuizzes(auth, parseId((await params).courseId, "That course")));
});
