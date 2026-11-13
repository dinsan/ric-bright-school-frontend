import type { SearchResults } from "@/features/search/types";
import { parseQuery } from "@/server/http/validation";
import { json, route } from "@/server/http/route";
import { search, searchInput } from "@/server/search/service";

/**
 * Global search (public): GET /api/search?q=fractions&limit=5 → courses and lessons. Cacheable briefly:
 * the same query from many people (or many keystrokes) costs one database round trip a minute.
 */
export const GET = route(async (request) =>
  json<SearchResults>(await search(parseQuery(request, searchInput)), {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
  }),
);
