import type { NextRequest } from "next/server";
import { teacherProfileInput, updateTeacherProfile } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const PATCH = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["teacher"]);
  return json(await updateTeacherProfile(auth, await parseBody(request, teacherProfileInput)));
});
