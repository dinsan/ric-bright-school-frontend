import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { startQuizAttempt } from "@/server/learning/quizzes";
import { parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ quizId: string }>;

/** Starts the quiz (201), or returns the attempt already in progress (200). */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  const { attempt, created } = await startQuizAttempt(auth, parseId((await params).quizId, "That quiz"));
  return json(attempt, created ? 201 : 200);
});
