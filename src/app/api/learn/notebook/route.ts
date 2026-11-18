import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { notebook, notebookInput } from "@/server/learning/notes";
import { parseQuery } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

/** Every note and bookmark of the student, newest first: GET /api/learn/notebook?q=… */
export const GET = route(async (request: NextRequest) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await notebook(auth, parseQuery(request, notebookInput)));
});
