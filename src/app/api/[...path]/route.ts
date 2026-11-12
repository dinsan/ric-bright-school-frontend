import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/server/bff";

// Same-origin gateway to the backend API: /api/me -> <API_URL><API_PREFIX>/me, with the session
// from httpOnly cookies. See src/lib/server/bff.ts and docs/auth.md.

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, { params }: Context) {
  const { path } = await params;
  return proxyToBackend(request, `/${path.map(encodeURIComponent).join("/")}`);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
