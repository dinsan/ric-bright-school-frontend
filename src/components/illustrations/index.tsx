import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

/*
 * Spot illustrations in the notebook style: ink outlines, offset "sticker" shadows and the
 * highlighter colours. Every colour is a token class (fill-accent, stroke-line, ...), so they
 * follow the theme. Decorative only (aria-hidden): the text next to them carries the meaning.
 * Size comes from the grade band (`illustration` utility): large for Grades 1–5, hidden for 9–12.
 */

export type IllustrationName = "search" | "empty" | "error" | "celebrate";

type Props = SVGProps<SVGSVGElement>;

const stroke = { strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Frame({ className, children, ...props }: Props) {
  return (
    <svg viewBox="0 0 200 160" fill="none" aria-hidden focusable="false" className={cn("illustration", className)} {...props}>
      {children}
    </svg>
  );
}

/** Nothing matched: a notebook page under a magnifying glass. */
export function SearchIllustration(props: Props) {
  return (
    <Frame {...props}>
      <rect x="42" y="24" width="100" height="120" rx="10" className="fill-line" transform="translate(6 6)" />
      <rect x="42" y="24" width="100" height="120" rx="10" className="fill-surface stroke-line" {...stroke} />
      <path d="M60 52h64M60 72h64M60 92h40M60 112h52" className="stroke-line-subtle" {...stroke} />
      <circle cx="132" cy="96" r="28" className="fill-accent stroke-line" strokeWidth={6} />
      <circle cx="132" cy="96" r="14" className="fill-surface stroke-line" strokeWidth={4} />
      <path d="M153 117l24 24" className="stroke-line" strokeWidth={10} strokeLinecap="round" />
    </Frame>
  );
}

/** Nothing here yet: an empty folder with a few sparkles. */
export function EmptyIllustration(props: Props) {
  return (
    <Frame {...props}>
      <path d="M34 54h44l10 12h78v72H34z" className="fill-line" transform="translate(6 6)" />
      <path d="M34 54h44l10 12h78v72H34z" className="fill-band-middle stroke-line" {...stroke} />
      <path d="M34 80h132v58H34z" className="fill-surface stroke-line" {...stroke} />
      <path d="M84 108h32" className="stroke-line-subtle" {...stroke} />
      <path d="M150 22v16M142 30h16M46 24v10M41 29h10M176 56v10M171 61h10" className="stroke-primary" {...stroke} />
    </Frame>
  );
}

/** Could not load: a plug pulled out of its socket. */
export function ErrorIllustration(props: Props) {
  return (
    <Frame {...props}>
      <path d="M20 96h34" className="stroke-line" strokeWidth={8} strokeLinecap="round" />
      <rect x="52" y="74" width="40" height="44" rx="8" className="fill-primary stroke-line" {...stroke} />
      <path d="M92 86h14M92 106h14" className="stroke-line" strokeWidth={6} strokeLinecap="round" />
      <rect x="124" y="70" width="44" height="52" rx="8" className="fill-line" transform="translate(5 5)" />
      <rect x="124" y="70" width="44" height="52" rx="8" className="fill-surface stroke-line" {...stroke} />
      <path d="M136 88v4M136 100v4" className="stroke-line" strokeWidth={6} strokeLinecap="round" />
      <path d="M168 96h16" className="stroke-line" strokeWidth={8} strokeLinecap="round" />
      <path d="M110 62l4 10M118 56l-1 12M104 130l6-8M116 134l1-10" className="stroke-danger" {...stroke} />
    </Frame>
  );
}

/** Done: a star badge with confetti. */
export function CelebrateIllustration(props: Props) {
  return (
    <Frame {...props}>
      <path d="M100 22l17 35 38 5-28 26 7 38-34-18-34 18 7-38-28-26 38-5z" className="fill-line" transform="translate(6 6)" />
      <path d="M100 22l17 35 38 5-28 26 7 38-34-18-34 18 7-38-28-26 38-5z" className="fill-accent stroke-line" {...stroke} />
      <path d="M30 40l8 8M170 36l-8 10M26 118l12-4M172 118l-12-6M60 146l4-10M142 146l-4-10" className="stroke-primary" {...stroke} />
      <circle cx="48" cy="84" r="5" className="fill-band-middle" />
      <circle cx="156" cy="84" r="5" className="fill-danger" />
    </Frame>
  );
}

export const illustrations: Record<IllustrationName, (props: Props) => React.JSX.Element> = {
  search: SearchIllustration,
  empty: EmptyIllustration,
  error: ErrorIllustration,
  celebrate: CelebrateIllustration,
};
