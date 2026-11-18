import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { listCertificates } from "@/server/learning/service";
import { json, route } from "@/server/http/route";

/** The student's certificates, newest first. */
export const GET = route(async (request: NextRequest) => json(await listCertificates(await requireAuth(request, ["student"]))));
