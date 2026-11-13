import type { NextRequest } from "next/server";
import { setTeacherVerification, teacherVerificationInput } from "@/server/admin/service";
import { requireAuth } from "@/server/auth/context";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

export const PUT = route(async (request: NextRequest, { params }: Params<{ id: string }>) => {
  const auth = await requireAuth(request, ["admin"]);
  const id = parseId((await params).id, "That user");
  return json(await setTeacherVerification(auth, id, await parseBody(request, teacherVerificationInput), request));
});
