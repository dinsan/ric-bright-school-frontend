import { CircleExclamationPoint, Inbox, PartyPopper, Search, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { illustrations, type IllustrationName } from "@/components/illustrations";
import { cn } from "@/lib/cn";

const icons: Record<IllustrationName, LucideIcon> = {
  search: Search,
  empty: Inbox,
  error: CircleExclamationPoint,
  celebrate: PartyPopper,
};

export interface EmptyStateProps {
  illustration: IllustrationName;
  title: ReactNode;
  description?: ReactNode;
  /** What the user can do next, usually one Button. */
  action?: ReactNode;
  /** Heading level for the title, to fit the page outline. Use 1 when the state is the whole page. */
  headingLevel?: 1 | 2 | 3;
  className?: string;
  role?: "status" | "alert";
}

/**
 * Shown instead of content that is missing: no results, nothing yet, could not load.
 * Presentation follows the grade band: a big illustration for Grades 1–5, a smaller one for
 * 6–8, and just a small icon for 9–12.
 */
export function EmptyState({ illustration, title, description, action, headingLevel = 2, className, role }: EmptyStateProps) {
  const Illustration = illustrations[illustration];
  const Icon = icons[illustration];
  const Heading = (`h${headingLevel}` as const);
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-line bg-surface p-card py-8 text-center",
        className,
      )}
    >
      <Illustration className="mb-1" />
      <Icon aria-hidden className="hidden size-8 text-fg-muted older:block" />
      <Heading className="text-heading">{title}</Heading>
      {description && <div className="max-w-md text-body text-fg-muted">{description}</div>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
