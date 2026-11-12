import type { ReactNode } from "react";

/** The top of a signed-in page: one h1, an optional explanation and page-level actions. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="grid max-w-2xl gap-2">
        <h1 className="text-title wrap-break-word">{title}</h1>
        {description && <div className="text-lead text-fg-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
