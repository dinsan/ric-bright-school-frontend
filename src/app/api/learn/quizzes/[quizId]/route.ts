import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { quizView } from "@/server/learning/quizzes";
import { parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ quizId: string }>;

/** The quiz player's data: the quiz, its questions (never the answers), the attempt in progress, the last result. */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await quizView(auth, parseId((await params).quizId, "That quiz")));
});
