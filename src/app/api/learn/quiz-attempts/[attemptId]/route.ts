import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { quizAttemptSaveInput, saveQuizAttempt } from "@/server/learning/quizzes";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ attemptId: string }>;

/** Autosave: the attempt's answers and flags, whole. 409 `attempt_submitted` once it is finished. */
export const PUT = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await saveQuizAttempt(auth, parseId((await params).attemptId, "That quiz attempt"), await parseBody(request, quizAttemptSaveInput)));
});
