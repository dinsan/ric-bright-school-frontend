import { listSubjects } from "@/server/catalog/service";
import { json, route } from "@/server/http/route";

export const GET = route(async () => json(await listSubjects(), { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" } }));
