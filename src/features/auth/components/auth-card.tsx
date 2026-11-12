import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** The card every auth page is built from: a title, a short explanation, then the form. */
export function AuthCard({ title, description, children, footer }: { title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid gap-6">
      <Card className="gap-6">
        <div className="grid gap-2">
          <h1 className="text-title">{title}</h1>
          {description && <div className="text-fg-muted">{description}</div>}
        </div>
        {children}
      </Card>
      {footer && <div className="grid gap-2 text-center text-small">{footer}</div>}
    </div>
  );
}

/** A text link in the auth pages' footers. */
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-bold text-link underline underline-offset-4">
      {children}
    </Link>
  );
}
