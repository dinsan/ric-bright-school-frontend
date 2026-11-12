"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { PAGE_SIZE } from "../constants";
import { useCourses, useSubjects } from "../hooks";
import { buildCatalogQuery, parseCatalogParams, type CatalogUrlState } from "../url-state";
import { CourseGrid, CourseGridSkeleton } from "./course-grid";
import { GradeFilter } from "./grade-filter";

export function CoursesBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const state = parseCatalogParams(useSearchParams());

  const navigate = (patch: Partial<CatalogUrlState>) => {
    const next: CatalogUrlState = { ...state, page: 1, ...patch };
    router.replace(`${pathname}${buildCatalogQuery(next)}`, { scroll: false });
  };

  const subjects = useSubjects();
  const courses = useCourses({
    gradeLevel: state.grade,
    subject: state.subject,
    q: state.q,
    page: state.page,
  });

  // The search box is controlled so it can follow the URL. `requestedQ` is the last query the
  // box itself sent. When the URL's `q` changes to anything else (Clear filters, the Courses
  // link, back/forward), the change came from outside, so the box takes the URL's value.
  // Changes the box caused are left alone, so text typed while the URL catches up is kept.
  const [searchText, setSearchText] = useState(state.q ?? "");
  const [requestedQ, setRequestedQ] = useState(state.q);
  const [seenQ, setSeenQ] = useState(state.q);
  if (state.q !== seenQ) {
    setSeenQ(state.q);
    if (state.q !== requestedQ) {
      setRequestedQ(state.q);
      setSearchText(state.q ?? "");
    }
  }

  const onSearch = useDebouncedCallback((value: string) => {
    const q = value.trim() || undefined;
    setRequestedQ(q);
    navigate({ q });
  }, 300);

  // After a page change, bring the results back into view and move focus to their heading,
  // so keyboard and screen reader users start at the top of the new page.
  const resultsRef = useRef<HTMLElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const changePage = (page: number) => {
    navigate({ page });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    resultsHeadingRef.current?.focus({ preventScroll: true });
  };

  const hasFilters = state.grade !== undefined || Boolean(state.subject) || Boolean(state.q);
  const pageCount = courses.data ? Math.ceil(courses.data.total / PAGE_SIZE) : 0;

  return (
    <div className="grid gap-8">
      <Card className="gap-5">
        <GradeFilter value={state.grade} onChange={(grade) => navigate({ grade })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Subject">
            <Select
              value={state.subject ?? ""}
              onChange={(event) => navigate({ subject: event.target.value || undefined })}
            >
              <option value="">All subjects</option>
              {subjects.data?.map((subject) => (
                <option key={subject.id} value={subject.slug}>
                  {subject.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Search by title">
            <Input
              type="search"
              placeholder="For example, fractions"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                onSearch(event.target.value);
              }}
            />
          </FormField>
        </div>
      </Card>

      <section
        ref={resultsRef}
        aria-label="Results"
        className={cn("scroll-mt-6 transition-opacity", courses.isPlaceholderData && "opacity-60")}
      >
        {courses.isPending ? (
          <CourseGridSkeleton />
        ) : courses.isError ? (
          <LoadError error={courses.error} onRetry={() => courses.refetch()} />
        ) : courses.data.items.length === 0 && courses.data.total > 0 ? (
          // An old or edited link points past the last page (for example ?page=99).
          <EmptyState
            illustration="search"
            title={`There is no page ${state.page}`}
            description={`These results have ${pluralize(pageCount, "page")}.`}
            action={<Button onClick={() => navigate({ page: pageCount })}>Go to page {pageCount}</Button>}
          />
        ) : courses.data.items.length === 0 ? (
          <EmptyResults hasFilters={hasFilters} onClear={() => router.replace(pathname, { scroll: false })} />
        ) : (
          <>
            <h2
              ref={resultsHeadingRef}
              tabIndex={-1}
              className="mb-4 text-small font-bold focus:outline-none"
              aria-live="polite"
            >
              {pluralize(courses.data.total, "course")}
            </h2>
            <CourseGrid courses={courses.data.items} />
            <Pagination className="mt-8" page={state.page} pageCount={pageCount} onChange={changePage} />
          </>
        )}
      </section>
    </div>
  );
}

function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const unreachable = !(error instanceof ApiError);
  return (
    <EmptyState
      role="alert"
      illustration="error"
      title="Courses did not load"
      description={
        unreachable ? "The course service could not be reached. Check your connection and try again." : error.message
      }
      action={<Button onClick={onRetry}>Try again</Button>}
    />
  );
}

function EmptyResults({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return hasFilters ? (
    <EmptyState
      illustration="search"
      title="No courses match these filters"
      description="Try another grade or subject, or search for a different title."
      action={<Button onClick={onClear}>Clear filters</Button>}
    />
  ) : (
    <EmptyState illustration="empty" title="No courses yet" description="New courses are on their way. Check back soon." />
  );
}
