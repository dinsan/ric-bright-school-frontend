import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { quizSubmitInput, submitQuizAttempt } from "@/server/learning/quizzes";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ attemptId: string }>;

/** Finishes the attempt (with its last answers) and marks it. Submitting again returns the same result. */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await submitQuizAttempt(auth, parseId((await params).attemptId, "That quiz attempt"), await parseBody(request, quizSubmitInput)));
});
