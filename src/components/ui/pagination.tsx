"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}

/** Previous / next paging. Hidden when there is only one page. */
export function Pagination({ page, pageCount, onChange, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const atStart = page <= 1;
  const atEnd = page >= pageCount;
  // aria-disabled, not disabled: a disabled button drops keyboard focus to the page body when you
  // reach the last page with "Next". This way focus stays put and the button says it is unavailable.
  // On phones the word "page" is visually hidden so the buttons stay on one line;
  // screen readers still hear "Previous page" / "Next page".
  return (
    <nav aria-label="Pagination" className={className}>
      {/* Phones: "Page X of Y" on its own line above the buttons, so large (Grades 1–5) buttons still fit. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button aria-disabled={atStart || undefined} onClick={() => !atStart && onChange(page - 1)}>
          <ChevronLeft aria-hidden />
          <span>
            Previous<span className="max-sm:sr-only"> page</span>
          </span>
        </Button>
        <p className="order-first w-full text-center text-small font-bold whitespace-nowrap sm:order-none sm:w-auto" aria-live="polite">
          Page {page} of {pageCount}
        </p>
        <Button aria-disabled={atEnd || undefined} onClick={() => !atEnd && onChange(page + 1)}>
          <span>
            Next<span className="max-sm:sr-only"> page</span>
          </span>
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
