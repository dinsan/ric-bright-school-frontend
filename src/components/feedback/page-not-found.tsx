import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Body of the not-found pages. */
export function PageNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-gutter py-16 sm:py-24">
      <EmptyState
        illustration="search"
        headingLevel={1}
        title={<span className="text-title">We can&apos;t find that page</span>}
        description="The link may be out of date, or the course may have been unpublished."
        action={<ButtonLink href="/courses">Browse courses</ButtonLink>}
      />
    </div>
  );
}
