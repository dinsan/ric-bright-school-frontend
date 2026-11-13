/** Shared by the search dialog (client) and the /search page (server): keep out of "use client" files. */

/** Example searches shown before anything is typed. */
export const SEARCH_SUGGESTIONS = ["fractions", "python", "grade 4", "water cycle", "ancient egypt"];

export function searchPageHref(query: string) {
  return `/search?q=${encodeURIComponent(query)}`;
}
