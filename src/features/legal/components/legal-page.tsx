import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { legalConfig, type LegalDocumentId } from "@/config/legal";
import { formatDate } from "@/lib/format";
import { Prose } from "./prose";

export interface LegalSection {
  /** Anchor id; also the table of contents link. Keep it stable: people link to sections. */
  id: string;
  title: string;
  content: ReactNode;
}

/**
 * A policy page: title, last-updated date, a draft notice until the texts are reviewed, an optional
 * summary (plain words first), a table of contents and the sections. The table of contents is made from
 * the same list as the sections, so its links always land.
 */
export function LegalPage({
  document,
  lead,
  summary,
  sections,
}: {
  document: LegalDocumentId;
  lead: ReactNode;
  summary?: ReactNode;
  sections: LegalSection[];
}) {
  const { title, updated } = legalConfig.documents[document];
  return (
    <div className="mx-auto max-w-6xl px-gutter py-10 lg:py-14">
      <Breadcrumb className="mb-6" items={[{ label: "Home", href: "/" }, { label: title }]} />
      <header className="max-w-2xl">
        <h1 className="text-title text-balance">{title}</h1>
        <p className="mt-3 text-lead text-fg-muted">{lead}</p>
        <p className="mt-3 text-small text-fg-muted">
          Last updated <time dateTime={updated}>{formatDate(updated)}</time>
        </p>
      </header>
      {!legalConfig.reviewed && <DraftNotice className="mt-6 max-w-2xl" />}
      {summary && <div className="mt-8 max-w-2xl">{summary}</div>}

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-labelledby="toc-heading" className="lg:sticky lg:top-6 lg:self-start">
          <h2 id="toc-heading" className="text-small font-bold text-fg-muted">
            On this page
          </h2>
          <ol className="mt-3 grid gap-2 border-l-2 border-line-subtle pl-4 text-small">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="underline-offset-4 hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id} className="scroll-mt-6 text-heading text-balance">
                {section.title}
              </h2>
              <Prose className="mt-4">{section.content}</Prose>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DraftNotice({ className }: { className?: string }) {
  return (
    <Alert tone="warning" title="This is a draft" className={className}>
      It describes how Lumina works today, but it has not been reviewed by a lawyer yet, and details marked
      &ldquo;to be confirmed&rdquo; will be completed before Lumina launches.
    </Alert>
  );
}

/** "In short": the plain-words version at the top of a policy. */
export function InShort({ points }: { points: ReactNode[] }) {
  return (
    <section aria-labelledby="in-short" className="rounded-card border-2 border-line bg-surface p-card shadow-sticker">
      <h2 id="in-short" className="text-heading">
        In short
      </h2>
      <ul className="mt-3 grid list-disc gap-2 pl-6">
        {points.map((point, index) => (
          <li key={index}>{point}</li>
        ))}
      </ul>
    </section>
  );
}
