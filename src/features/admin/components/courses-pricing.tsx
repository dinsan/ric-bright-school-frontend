"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import type { AdminCourse, CourseStatus } from "@/features/catalog/types";
import { cn } from "@/lib/cn";
import { formatPrice, pluralize } from "@/lib/format";
import { adminApi } from "../api";
import { centsToInput, inputToCents } from "../price-input";

const PAGE_SIZE = 20;
const STATUSES: CourseStatus[] = ["published", "draft", "archived"];
const statusLabels: Record<CourseStatus, string> = { published: "Published", draft: "Draft", archived: "Archived" };
const statusTones: Record<CourseStatus, BadgeTone> = { published: "success", draft: "warning", archived: "neutral" };

/**
 * Course prices (/admin/courses): every course with what it costs, and an inline editor per course.
 * State lives in the URL (?q=&status=&page=) so searches can be shared and the back button works.
 */
export function CoursesPricing() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = (STATUSES as string[]).includes(params.get("status") ?? "") ? (params.get("status") as CourseStatus) : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [text, setText] = useState(q);

  const go = (next: { q?: string; status?: string; page?: number }) => {
    const search = new URLSearchParams();
    const merged = { q, status, page: 1, ...next };
    if (merged.q) search.set("q", merged.q);
    if (merged.status) search.set("status", merged.status);
    if (merged.page > 1) search.set("page", String(merged.page));
    router.replace(`${pathname}${search.size ? `?${search}` : ""}`, { scroll: false });
  };

  const courses = useQuery({
    queryKey: ["admin", "courses", { q, status, page }],
    queryFn: () => adminApi.courses({ q: q || undefined, status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const pageCount = courses.data ? Math.ceil(courses.data.total / PAGE_SIZE) : 0;

  return (
    <div className="grid gap-6">
      <Card>
        <form
          role="search"
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            go({ q: text.trim() });
          }}
        >
          <FormField label="Title, slug or subject">
            <Input type="search" value={text} onChange={(event) => setText(event.target.value)} />
          </FormField>
          <FormField label="Status">
            <Select value={status ?? ""} onChange={(event) => go({ status: event.target.value || undefined })}>
              <option value="">All statuses</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </Select>
          </FormField>
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>
      </Card>

      <section aria-label="Results" className={cn("transition-opacity", courses.isPlaceholderData && "opacity-60")}>
        {courses.isPending ? (
          <div className="grid gap-2" role="status" aria-label="Loading courses">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : courses.isError ? (
          <EmptyState
            illustration="error"
            role="alert"
            title="Courses didn't load"
            description={courses.error.message}
            action={<Button onClick={() => courses.refetch()}>Try again</Button>}
          />
        ) : courses.data.items.length === 0 ? (
          <EmptyState illustration="search" title="No courses match" description="Try part of a title or a subject, or another status." />
        ) : (
          <>
            <h2 className="mb-3 text-small font-bold" aria-live="polite">
              {pluralize(courses.data.total, "course")}
            </h2>
            <ul className="grid gap-2">
              {courses.data.items.map((course) => (
                <li key={course.id}>
                  <Card variant="flat" className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
                    <div className="grid min-w-0 flex-1 basis-64 gap-1">
                      <p className="truncate font-bold">{course.title}</p>
                      <p className="flex flex-wrap items-center gap-2 text-small text-fg-muted">
                        Grade {course.grade_level} · {course.subject.name}
                        <Badge tone={statusTones[course.status]}>{statusLabels[course.status]}</Badge>
                        {course.price_cents === 0 && <Badge tone="success">Free</Badge>}
                      </p>
                    </div>
                    <PriceEditor course={course} />
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination className="mt-6" page={page} pageCount={pageCount} onChange={(next) => go({ page: next })} />
          </>
        )}
      </section>
    </div>
  );
}

function PriceEditor({ course }: { course: AdminCourse }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(() => centsToInput(course.price_cents));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (priceCents: number) => adminApi.setCoursePrice(course.id, priceCents),
    onSuccess: (updated) => {
      setValue(centsToInput(updated.price_cents));
      queryClient.setQueriesData<{ items: AdminCourse[] }>({ queryKey: ["admin", "courses"] }, (page) =>
        page ? { ...page, items: page.items.map((item) => (item.id === updated.id ? updated : item)) } : page,
      );
      toast({ title: `${course.title} is now ${formatPrice(updated.price_cents)}`, tone: "success" });
    },
    onError: (mutationError) => toast({ title: "The price wasn't saved", description: mutationError.message, tone: "danger" }),
  });

  const cents = inputToCents(value);
  const changed = cents !== null && cents !== course.price_cents;

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const next = inputToCents(value);
        if (next === null) {
          setError("Enter a price from 0 to 999.99 (0 = free).");
          return;
        }
        setError(null);
        if (next !== course.price_cents) save.mutate(next);
      }}
    >
      <FormField label={`Price of ${course.title} (dollars)`} hideLabel error={error ?? undefined} className="w-32">
        <Input
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
      </FormField>
      {/* Enabled while the text isn't a valid price, so pressing it explains what to fix. */}
      <Button type="submit" size="sm" loading={save.isPending} disabled={cents !== null && !changed}>
        Save
      </Button>
    </form>
  );
}
