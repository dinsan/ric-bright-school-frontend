import type { NextRequest } from "next/server";
import { endOtherSessions } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { json, route } from "@/server/http/route";

export const POST = route(async (request: NextRequest) => {
  await endOtherSessions(await requireAuth(request));
  return json({ signed_out_elsewhere: true });
});
