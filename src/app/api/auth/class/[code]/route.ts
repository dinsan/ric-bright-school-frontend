import { classRoster } from "@/server/auth/service";
import { json, type Params, route } from "@/server/http/route";

export const GET = route(async (request, { params }: Params<{ code: string }>) => {
  const { code } = await params;
  return json(await classRoster(code, request));
});
