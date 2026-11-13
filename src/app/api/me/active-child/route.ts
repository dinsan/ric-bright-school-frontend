import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { activeChildInput, setActiveChild } from "@/server/family/service";
import { parseBody } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const PUT = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["parent"]);
  const input = await parseBody(request, activeChildInput);
  await setActiveChild(auth, input);
  return json({ active_child_id: input.child_id });
});
