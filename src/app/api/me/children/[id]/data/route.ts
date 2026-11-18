import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { childDataCopy } from "@/server/family/service";
import { parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

/** A copy of the child's data as a JSON download (the filename never carries the child's name). */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent"]);
  const data = await childDataCopy(auth, parseId((await params).id, "That child"));
  return json(data, {
    headers: {
      "content-disposition": `attachment; filename="lumina-child-data-${data.exported_at.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});
