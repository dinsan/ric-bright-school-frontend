import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { getCertificate } from "@/server/learning/service";
import { parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ certificateId: string }>;

export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await getCertificate(auth, parseId((await params).certificateId, "That certificate")));
});
