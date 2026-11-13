import { BookOpen, Clock, FileText } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { pluralize } from "@/lib/format";
import type { SearchHit } from "../types";
import { Highlight } from "./highlight";

/** Results on the /search page: real links (open in a new tab, share), grouped by kind. */
export function SearchResultsList({ title, hits, terms, more }: { title: string; hits: SearchHit[]; terms: string[]; more: boolean }) {
  if (hits.length === 0) return null;
  const Icon = hits[0]!.kind === "course" ? BookOpen : FileText;
  return (
    <section aria-labelledby={`results-${title}`}>
      <h2 id={`results-${title}`} className="text-heading">
        {title} <span className="text-lead font-bold text-fg-muted">({more ? `${hits.length}+` : hits.length})</span>
      </h2>
      <ul className="mt-4 grid gap-3">
        {hits.map((hit) => (
          <li key={hit.id}>
            <Card asChild interactive variant="flat" className="flex-row items-start gap-3 p-4">
              <Link href={hit.url}>
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-control border-2 border-line bg-accent text-accent-fg">
                  <Icon className="size-5" />
                </span>
                <span className="grid min-w-0 gap-1">
                  <span className="text-lead font-extrabold wrap-break-word">
                    <Highlight text={hit.title} terms={terms} />
                  </span>
                  <span className="text-small text-fg-muted">
                    <Highlight text={hit.summary} terms={terms} />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small font-bold">
                    {hit.course && <span>Lesson in {hit.course.title}</span>}
                    <span>
                      Grade {hit.grade_level} · {hit.subject.name}
                    </span>
                    {hit.duration_minutes ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock aria-hidden className="size-4" />
                        {hit.duration_minutes} min
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
      {more && <p className="mt-3 text-small text-fg-muted">Showing the best {pluralize(hits.length, title.toLowerCase().replace(/s$/, ""))}. Add words to narrow the search.</p>}
    </section>
  );
}
