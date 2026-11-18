import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { answerReview, reviewAnswerInput } from "@/server/learning/review";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ itemId: string }>;

/** Checks an answer; in review mode it also reschedules the question. */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await answerReview(auth, parseId((await params).itemId, "That question"), await parseBody(request, reviewAnswerInput)));
});
