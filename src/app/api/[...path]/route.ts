import { errorEnvelope } from "@/server/http/route";

// Any /api path without a handler: a JSON 404 in the usual error envelope (not the HTML not-found page).
const notFound = () => errorEnvelope(404, "not_found", "There is no API endpoint at this address.");

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
