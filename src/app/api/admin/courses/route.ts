import type { NextRequest } from "next/server";
import { courseAdminSearchInput, searchCoursesAdmin } from "@/server/admin/catalog";
import { requireAuth } from "@/server/auth/context";
import { parseQuery } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

export const GET = route(async (request: NextRequest) => {
  await requireAuth(request, ["admin"]);
  return json(await searchCoursesAdmin(parseQuery(request, courseAdminSearchInput)));
});
