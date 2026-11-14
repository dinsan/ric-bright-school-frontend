/** The search API's JSON shapes (GET /api/search), shared by the browser and the server. */

export type SearchHitKind = "course" | "lesson";

export interface SearchHit {
  kind: SearchHitKind;
  id: string;
  title: string;
  summary: string;
  /** Where the result leads: the course page, or the lesson in its course's outline. */
  url: string;
  grade_level: number;
  subject: { slug: string; name: string };
  /** Lessons: the course they belong to. */
  course?: { slug: string; title: string };
  /** Lessons: how long they take. */
  duration_minutes?: number | null;
}

export interface SearchResults {
  query: string;
  /** A grade found in the query ("grade 4", "4th grade"), used as a filter. */
  grade: number | null;
  courses: SearchHit[];
  lessons: SearchHit[];
  /** More courses / lessons match than were returned (the /search page shows more). */
  more: { courses: boolean; lessons: boolean };
  /** Nothing matched exactly, so these are close matches for a possible typo ("fracton"). */
  approximate: boolean;
  /** With close matches only: the corrected words ("fracton" → "fraction"), for "Did you mean …?". */
  suggestion: string | null;
}

export const SEARCH_MAX_LENGTH = 100;
