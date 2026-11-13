import type { NextRequest } from "next/server";
import { searchUsers, userSearchInput } from "@/server/admin/service";
import { requireAuth } from "@/server/auth/context";
import { parseQuery } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const GET = route(async (request: NextRequest) => {
  await requireAuth(request, ["admin"]);
  return json(await searchUsers(parseQuery(request, userSearchInput)));
});
