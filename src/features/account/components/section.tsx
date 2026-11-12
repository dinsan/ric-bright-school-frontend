import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** One block of the account pages: a heading, what it is for, and its controls. */
export function AccountSection({ id, title, description, children, tone }: { id?: string; title: string; description?: ReactNode; children: ReactNode; tone?: "danger" }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-24">
      <Card className={tone === "danger" ? "border-danger" : undefined}>
        <div className="grid gap-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-heading">
            {title}
          </h2>
          {description && <div className="max-w-2xl text-small text-fg-muted">{description}</div>}
        </div>
        {children}
      </Card>
    </section>
  );
}
