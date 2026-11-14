import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { GRADES } from "@/features/catalog/constants";
import { SearchResultsList } from "@/features/search/components/search-results-list";
import { SEARCH_SUGGESTIONS, searchPageHref } from "@/features/search/constants";
import { isSearchable, parseSearchQuery } from "@/features/search/query";
import { SEARCH_MAX_LENGTH } from "@/features/search/types";
import { listSubjects } from "@/server/catalog/service";
import { search } from "@/server/search/service";

type Props = { searchParams: Promise<{ q?: string | string[]; grade?: string | string[]; subject?: string | string[] }> };

/** Search results pages are for people, not search engines (they would index endless variations). */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = first((await searchParams).q);
  return { title: q ? `Search: ${q}` : "Search", robots: { index: false, follow: true } };
}

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, SEARCH_MAX_LENGTH) ?? "";
}

/**
 * /search?q=…&grade=…&subject=…: the full results (up to 20 courses and 20 lessons), with a grade and
 * subject filter (FE-PUB-12). A plain GET form, so it also works before JavaScript has loaded; the
 * search dialog's "See all results" leads here.
 */
export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q);
  const subjects = await listSubjects();
  const gradeParam = Number(first(params.grade));
  const grade = GRADES.includes(gradeParam) ? gradeParam : undefined;
  const subjectParam = first(params.subject);
  const subject = subjects.some((entry) => entry.slug === subjectParam) ? subjectParam : undefined;
  const parsed = parseSearchQuery(q);
  const results = isSearchable(parsed) || grade !== undefined || subject ? await search({ q, limit: 20, grade, subject }) : null;
  const total = results ? results.courses.length + results.lessons.length : 0;

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-gutter py-10 lg:py-14">
      <div className="grid gap-5">
        <h1 className="text-title">{q ? <>Results for &ldquo;{q}&rdquo;</> : "Search"}</h1>
        <form action="/search" method="get" role="search" aria-label="Courses and lessons" className="grid gap-3">
          <div className="flex gap-3">
            <label htmlFor="search-q" className="sr-only">
              Search courses and lessons
            </label>
            <Input id="search-q" name="q" type="search" defaultValue={q} maxLength={SEARCH_MAX_LENGTH} placeholder="For example: fractions, python, grade 4" className="flex-1" />
            <button type="submit" className="inline-flex min-h-control items-center gap-2 rounded-control border-2 border-line bg-primary px-control-x font-bold text-primary-fg shadow-sticker">
              <Search aria-hidden className="size-5" />
              Search
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <label htmlFor="search-grade" className="sr-only">
              Grade
            </label>
            <Select id="search-grade" name="grade" defaultValue={grade ?? ""} className="w-auto">
              <option value="">All grades</option>
              {GRADES.map((value) => (
                <option key={value} value={value}>
                  Grade {value}
                </option>
              ))}
            </Select>
            <label htmlFor="search-subject" className="sr-only">
              Subject
            </label>
            <Select id="search-subject" name="subject" defaultValue={subject ?? ""} className="w-auto">
              <option value="">All subjects</option>
              {subjects.map((entry) => (
                <option key={entry.slug} value={entry.slug}>
                  {entry.name}
                </option>
              ))}
            </Select>
            {/* The selects submit with the Search button: no JavaScript needed. */}
          </div>
        </form>
        {results && (
          <p role="status" className="text-small font-bold text-fg-muted">
            {total === 0
              ? "No results"
              : `${results.more.courses ? "Over " : ""}${results.courses.length} ${results.courses.length === 1 ? "course" : "courses"} and ${results.more.lessons ? "over " : ""}${results.lessons.length} ${results.lessons.length === 1 ? "lesson" : "lessons"}`}
            {results.grade !== null && ` in Grade ${results.grade}`}
            {subject && ` in ${subjects.find((entry) => entry.slug === subject)?.name}`}
            {results.approximate && total > 0 && ": no exact matches, these are close matches. Check the spelling?"}
          </p>
        )}
        {results?.suggestion && (
          <p className="text-small">
            Did you mean{" "}
            <Link
              href={`/search?${new URLSearchParams({ q: results.suggestion, ...(grade ? { grade: String(grade) } : {}), ...(subject ? { subject } : {}) })}`}
              className="font-bold underline underline-offset-4 hover:no-underline"
            >
              {results.suggestion}
            </Link>
            ?
          </p>
        )}
      </div>

      {results && total > 0 && (
        <div className="grid gap-10">
          <SearchResultsList title="Courses" hits={results.courses} terms={parsed.terms} more={results.more.courses} />
          <SearchResultsList title="Lessons" hits={results.lessons} terms={parsed.terms} more={results.more.lessons} />
        </div>
      )}

      {results && total === 0 && (
        <EmptyState
          illustration="search"
          title={`Nothing matches “${q}”`}
          description="Check the spelling, try fewer or different words, or browse all the courses."
          action={<ButtonLink href="/courses">Browse all courses</ButtonLink>}
        />
      )}

      {!results && (
        <div className="grid gap-3">
          <p className="text-fg-muted">Search every course and lesson by title, topic, subject or grade. For example:</p>
          <ul className="flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.map((suggestion) => (
              <li key={suggestion}>
                <a href={searchPageHref(suggestion)} className="inline-block rounded-control border-2 border-line bg-surface px-3 py-1 text-small font-bold hover:bg-surface-sunken">
                  {suggestion}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
