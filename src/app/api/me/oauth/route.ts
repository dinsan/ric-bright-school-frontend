import type { NextRequest } from "next/server";
import { linkedAccounts } from "@/server/accounts/service";
import { requireAuth } from "@/server/auth/context";
import { json, route } from "@/server/http/route";

export const GET = route(async (request: NextRequest) => json(await linkedAccounts(await requireAuth(request))));
