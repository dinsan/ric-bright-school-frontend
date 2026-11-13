"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchApi } from "./api";
import { isSearchable, parseSearchQuery } from "./query";

/** Debounce while typing: fast enough to feel instant, slow enough not to query every keystroke. */
export const SEARCH_DEBOUNCE_MS = 150;

/**
 * Instant search for `input`: waits for a short pause in typing, keeps showing the previous results while
 * the next ones load (no flicker), and cancels requests that are no longer needed.
 */
export function useInstantSearch(input: string, { limit = 5, enabled = true }: { limit?: number; enabled?: boolean } = {}) {
  const query = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS);
  const parsed = useMemo(() => parseSearchQuery(query), [query]);
  const searchable = isSearchable(parsed);
  const result = useQuery({
    queryKey: ["search", query, limit],
    queryFn: ({ signal }) => searchApi.search(query, limit, signal),
    enabled: enabled && searchable,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  return {
    query,
    terms: parsed.terms,
    searchable,
    /** Results for the current text (stale ones are kept while the next arrive). */
    data: searchable ? result.data : undefined,
    /** Still waiting: typing, or the request is in flight. */
    pending: searchable && (input.trim() !== query || result.isFetching),
    error: result.isError && searchable,
  };
}
