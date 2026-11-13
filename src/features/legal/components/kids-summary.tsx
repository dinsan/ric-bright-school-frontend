import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface KidsPoint {
  icon: LucideIcon;
  text: string;
}

/**
 * "The short version, for kids": a few very plain sentences, in the Grades 1–5 presentation
 * (data-band="elementary": bigger text and spacing), each with an icon so it reads at a glance.
 */
export function KidsSummary({ title = "The short version, for kids", points, className }: { title?: string; points: KidsPoint[]; className?: string }) {
  return (
    <section
      data-band="elementary"
      aria-labelledby="kids-summary"
      className={cn("rounded-card border-2 border-line bg-band-elementary p-card text-band-elementary-fg shadow-sticker", className)}
    >
      <h2 id="kids-summary" className="text-heading">
        {title}
      </h2>
      <ul className="mt-4 grid gap-3">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-body">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-fg">
              <Icon aria-hidden className="size-5" />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
