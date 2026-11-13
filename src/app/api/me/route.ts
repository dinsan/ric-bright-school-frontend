import type { NextRequest } from "next/server";
import { meFor } from "@/server/accounts/queries";
import { deleteAccount, deleteInput, profileInput, updateProfile } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { clearSessionCookies } from "@/server/auth/session";
import { parseBody } from "@/server/http/validation";
import { json, noContent, route } from "@/server/http/route";

export const GET = route(async (request: NextRequest) => json(await meFor((await requireAuth(request)).user)));

export const PATCH = route(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  return json(await updateProfile(auth, await parseBody(request, profileInput)));
});

/** Deletes the account; the session goes with it. */
export const DELETE = route(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await deleteAccount(auth, await parseBody(request, deleteInput), request);
  const response = noContent();
  clearSessionCookies(response.cookies);
  return response;
});
