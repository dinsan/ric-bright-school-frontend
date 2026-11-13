import type { ReactNode } from "react";

export function Section({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="grid scroll-mt-6 gap-5" id={id}>
      <div className="grid gap-1">
        <h2 id={`${id}-title`} className="text-title">
          {title}
        </h2>
        {description && <p className="max-w-3xl text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Example({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-3">
      <h3 className="text-small font-bold text-fg-muted uppercase tracking-wide">{title}</h3>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </div>
  );
}
