import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A home-page section: an h2 with an optional lead, in the page's width. `id` allows links like /#faq. */
export function MarketingSection({
  id,
  title,
  lead,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("mx-auto max-w-6xl scroll-mt-6 px-gutter py-14 lg:py-20", className)}>
      <div className="max-w-2xl">
        <h2 id={`${id}-title`} className="text-title text-balance">
          {title}
        </h2>
        {lead && <p className="mt-3 text-lead text-fg-muted">{lead}</p>}
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}
