import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { deleteNote, noteUpdateInput, updateNote } from "@/server/learning/notes";
import { parseBody, parseId } from "@/server/http/validation";
import { json, noContent, type Params, route } from "@/server/http/route";

type Context = Params<{ noteId: string }>;

export const PATCH = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  return json(await updateNote(auth, parseId((await params).noteId, "That note"), await parseBody(request, noteUpdateInput)));
});

export const DELETE = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  await deleteNote(auth, parseId((await params).noteId, "That note"));
  return noContent();
});
