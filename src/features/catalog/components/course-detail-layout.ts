/**
 * Layout classes shared by the course detail page and its loading skeleton, so the skeleton
 * keeps the same shape as the real page and nothing jumps when the content arrives.
 */
export const courseDetailLayout = {
  page: "mx-auto max-w-6xl px-gutter py-10 lg:py-14",
  breadcrumb: "mb-8",
  columns: "grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]",
  gradeMark: "mb-6 size-16 text-4xl",
  // Long titles: balanced lines, and long words wrap instead of overflowing.
  title: "text-title text-balance wrap-break-word",
  summary: "mt-4 max-w-2xl text-lead text-fg-muted",
  aside: "h-fit",
  // Below lg the aside spans the full width, so lay the facts out in a row instead of a tall column.
  facts: "grid gap-4 text-small sm:grid-cols-3 lg:grid-cols-1",
} as const;
