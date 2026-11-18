import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth/context";
import { learningPath } from "@/server/learning/paths";
import { parseQuery } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

const pathInput = z.object({ subject: z.string().trim().max(80).optional() });

/** A subject's learning path for the student: GET /api/learn/path?subject=mathematics. */
export const GET = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await learningPath(auth, parseQuery(request, pathInput).subject));
});
