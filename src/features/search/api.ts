import { apiFetch } from "@/lib/api-client";
import type { SearchResults } from "./types";

export const searchApi = {
  search: (q: string, limit: number, signal?: AbortSignal) => apiFetch<SearchResults>("/search", { searchParams: { q, limit }, signal }),
};
