import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface BreadcrumbItem {
  label: string;
  /** Leave out for the current page (the last item). */
  href?: string;
}

/** Where the current page sits. The last item is the current page and is not a link. */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-small font-bold text-fg-muted", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="underline underline-offset-4 hover:text-fg">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "max-w-full truncate text-fg")}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className="size-4 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
