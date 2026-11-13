import { courseSearchInput, listCourses } from "@/server/catalog/service";
import { parseQuery } from "@/server/http/validation";
import { json, route } from "@/server/http/route";

/** Public catalog: cacheable by browsers and CDNs for a minute. */
const CACHE = { "cache-control": "public, max-age=60, stale-while-revalidate=300" };

export const GET = route(async (request) => json(await listCourses(parseQuery(request, courseSearchInput)), { headers: CACHE }));
