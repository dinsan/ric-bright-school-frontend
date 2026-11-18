import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { deleteAssignment } from "@/server/teaching/service";
import { parseId } from "@/server/http/validation";
import { noContent, type Params, route } from "@/server/http/route";

type Context = Params<{ assignmentId: string }>;

export const DELETE = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["teacher"]);
  await deleteAssignment(auth, parseId((await params).assignmentId, "That assignment"));
  return noContent();
});
