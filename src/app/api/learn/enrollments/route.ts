import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { enroll, enrollInput, listEnrollments } from "@/server/learning/service";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

/** GET: the student's courses with their progress. POST: start a course (201, or 200 if already enrolled). */
export const GET = route(async (request: NextRequest) => json(await listEnrollments(await requireAuth(request, ["student"]))));

export const POST = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["student"]);
  const { enrollment, created } = await enroll(auth, await parseBody(request, enrollInput));
  return json(enrollment, created ? 201 : 200);
});
