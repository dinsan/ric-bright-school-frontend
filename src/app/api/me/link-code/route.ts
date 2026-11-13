import type { NextRequest } from "next/server";
import { createLinkCode } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { json, route } from "@/server/http/route";

/** Students: a one-time code a parent types to link to this account. */
export const POST = route(async (request: NextRequest) => json(await createLinkCode(await requireAuth(request, ["student"])), 201));
