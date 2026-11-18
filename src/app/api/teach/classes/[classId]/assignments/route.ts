import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { assignmentCreateInput, createAssignment, listClassAssignments } from "@/server/teaching/service";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ classId: string }>;

/** GET: the class's assignments with each student's progress. POST: set new work. */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["teacher"]);
  return json(await listClassAssignments(auth, parseId((await params).classId, "That class")));
});

export const POST = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["teacher"]);
  const classId = parseId((await params).classId, "That class");
  return json(await createAssignment(auth, classId, await parseBody(request, assignmentCreateInput)), 201);
});
