"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { usePreferences } from "@/hooks/use-preferences";
import { Section } from "./section";

/** [token, the background it sits on, minimum ratio] */
const COLOR_PAIRS: Array<[string, string, number]> = [
  ["fg", "canvas", 4.5],
  ["fg-muted", "surface", 4.5],
  ["link", "surface", 4.5],
  ["primary-fg", "primary", 4.5],
  ["accent-fg", "accent", 4.5],
  ["inverse-fg", "inverse", 4.5],
  ["success-fg", "success", 4.5],
  ["warning-fg", "warning", 4.5],
  ["danger-fg", "danger", 4.5],
  ["danger-text", "surface", 4.5],
  ["info-soft-fg", "info-soft", 4.5],
  ["success-soft-fg", "success-soft", 4.5],
  ["warning-soft-fg", "warning-soft", 4.5],
  ["danger-soft-fg", "danger-soft", 4.5],
  ["band-elementary-fg", "band-elementary", 4.5],
  ["band-middle-fg", "band-middle", 4.5],
  ["band-high-fg", "band-high", 4.5],
  ["line", "surface", 3],
  ["focus", "canvas", 3],
];

function luminance(rgb: string) {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? ["0", "0", "0"]).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function resolveColor(token: string) {
  const probe = document.createElement("span");
  probe.style.color = `var(--${token})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

/** Reads the live token values, so the numbers always match the current theme. */
function useLiveContrast() {
  const { resolvedTheme, band } = usePreferences();
  const [ratios, setRatios] = useState<Record<string, { fg: string; bg: string; ratio: number }>>({});
  useEffect(() => {
    // Measure in the next frame, once the new theme's styles are applied.
    const frame = requestAnimationFrame(() => {
      const next: typeof ratios = {};
      for (const [fg, bg] of COLOR_PAIRS) {
        const [a, b] = [luminance(resolveColor(fg)), luminance(resolveColor(bg))].sort((x, y) => y - x);
        next[`${fg}/${bg}`] = { fg: resolveColor(fg), bg: resolveColor(bg), ratio: (a! + 0.05) / (b! + 0.05) };
      }
      setRatios(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme, band]);
  return ratios;
}

export function ColorsSection() {
  const ratios = useLiveContrast();
  return (
    <Section
      id="colour"
      title="Colour"
      description="Semantic tokens only: components never use raw colours, so every theme works everywhere. Ratios below are measured live in the current theme; `npm run tokens:check` checks every pair in every theme."
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COLOR_PAIRS.map(([fg, bg, min]) => {
          const entry = ratios[`${fg}/${bg}`];
          const ok = entry ? entry.ratio >= min : true;
          return (
            <li key={`${fg}/${bg}`} className="flex items-center gap-3 rounded-card border-2 border-line bg-surface p-3">
              <span
                aria-hidden
                className="grid size-14 shrink-0 place-items-center rounded-control border-2 border-line text-lead font-black"
                style={{ background: `var(--${bg})`, color: `var(--${fg})` }}
              >
                Aa
              </span>
              <span className="grid min-w-0 gap-0.5 text-small">
                <code className="truncate font-mono font-bold">{fg}</code>
                <code className="truncate font-mono text-fg-muted">on {bg}</code>
                {entry && (
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{entry.ratio.toFixed(2)}:1</span>
                    <Badge tone={ok ? "success" : "danger"}>{ok ? `≥ ${min}` : `< ${min}`}</Badge>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// Literal class names: Tailwind only generates classes it can find in the source.
const TYPE_SCALE = [
  ["display", "text-display", "Start with your grade."],
  ["title", "text-title", "Fractions and decimals"],
  ["heading", "text-heading", "Unit 2: Adding fractions"],
  ["lead", "text-lead", "Learn to add fractions with the same denominator."],
  ["body", "text-body", "Body text for lessons and descriptions. Lexend keeps letters distinct for new readers."],
  ["small", "text-small", "Hints, labels and secondary text."],
  ["caption", "text-caption", "Captions and metadata."],
] as const;

export function TypographySection() {
  const { band } = usePreferences();
  const [sizes, setSizes] = useState<Record<string, string>>({});
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const next: Record<string, string> = {};
      for (const [name] of TYPE_SCALE) {
        const el = document.querySelector<HTMLElement>(`[data-type-sample="${name}"]`);
        if (el) next[name] = getComputedStyle(el).fontSize;
      }
      setSizes(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [band]);
  return (
    <Section
      id="type"
      title="Typography"
      description="Lexend, one family. Sizes follow the grade band: bigger for Grades 1–5, calmer for 9–12. Titles and display scale fluidly with the screen."
    >
      <div className="grid gap-4 rounded-card border-2 border-line bg-surface p-card">
        {TYPE_SCALE.map(([name, className, sample]) => (
          <div key={name} className="grid gap-1 border-b-2 border-line-subtle pb-4 last:border-0 last:pb-0 md:grid-cols-[10rem_1fr] md:items-baseline">
            <code className="font-mono text-small text-fg-muted">
              text-{name} <span className="tabular-nums">{sizes[name] ?? ""}</span>
            </code>
            <p data-type-sample={name} className={`${className} wrap-break-word`}>
              {sample}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

const SCALES = {
  spacing: [
    ["gutter", "Page side padding", "1.25rem", "1.25rem"],
    ["card", "Card and dialog padding", "per band", "var(--space-card)"],
    ["stack", "Gap between form fields", "per band", "var(--space-stack)"],
    ["control", "Button and input height", "per band (56 / 44 / 40 px)", "var(--control-h)"],
    ["check", "Checkbox and radio size", "per band", "var(--check-size)"],
  ],
  radius: [
    ["rounded-control", "Buttons, inputs, chips"],
    ["rounded-card", "Cards, dialogs, menus"],
    ["rounded-full", "Avatars, badges, switches"],
  ],
  shadow: [
    ["shadow-sticker", "Cards, buttons, menus"],
    ["shadow-sticker-lg", "Dialogs, sheets, hover lift"],
  ],
  z: [
    ["z-raised", "10", "Overlapping content"],
    ["z-sticky", "100", "Sticky headers"],
    ["z-overlay", "400", "Dialog scrim"],
    ["z-modal", "410", "Dialogs, sheets"],
    ["z-popover", "500", "Menus (also inside dialogs)"],
    ["z-toast", "600", "Toasts"],
    ["z-tooltip", "700", "Tooltips"],
    ["z-skip", "800", "Skip link"],
  ],
  motion: [
    ["duration-fast", "120ms", "Hover, press, colour changes"],
    ["duration-base", "200ms", "Popovers, fades (default)"],
    ["duration-slow", "320ms", "Sheets, progress fill"],
    ["ease-playful", "band", "Bouncy for Grades 1–5, plain otherwise"],
  ],
};

export function ScalesSection() {
  return (
    <Section
      id="scales"
      title="Spacing, radius, shadow, layers, motion"
      description="Named tokens sit on top of Tailwind's 4px spacing scale. Everything that moves collapses to instant under reduced motion."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-3 rounded-card border-2 border-line bg-surface p-card">
          <h3 className="text-heading">Spacing</h3>
          {SCALES.spacing.map(([name, use, value, size]) => (
            <div key={name} className="grid gap-1">
              <div className="flex justify-between gap-2 text-small">
                <code className="font-mono font-bold">{name}</code>
                <span className="text-fg-muted">{value}</span>
              </div>
              <div className="flex items-center gap-3">
                <span aria-hidden className="h-3 rounded-full bg-primary" style={{ width: size }} />
                <span className="text-caption text-fg-muted">{use}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid content-start gap-4 rounded-card border-2 border-line bg-surface p-card">
          <h3 className="text-heading">Radius and shadow</h3>
          <div className="flex flex-wrap gap-4">
            {SCALES.radius.map(([cls, use]) => (
              <div key={cls} className="grid justify-items-center gap-1 text-center text-caption">
                <span aria-hidden className={`size-16 border-2 border-line bg-accent ${cls}`} />
                <code className="font-mono">{cls}</code>
                <span className="text-fg-muted">{use}</span>
              </div>
            ))}
            {SCALES.shadow.map(([cls, use]) => (
              <div key={cls} className="grid justify-items-center gap-1 text-center text-caption">
                <span aria-hidden className={`size-16 rounded-card border-2 border-line bg-surface ${cls}`} />
                <code className="font-mono">{cls}</code>
                <span className="text-fg-muted">{use}</span>
              </div>
            ))}
          </div>
        </div>
        <TokenTable title="Layers (z-index)" rows={SCALES.z} />
        <TokenTable title="Motion" rows={SCALES.motion} />
      </div>
    </Section>
  );
}

function TokenTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-card border-2 border-line bg-surface p-card">
      <table className="w-full text-left text-small">
        <caption className="mb-2 text-left text-heading">{title}</caption>
        <thead>
          <tr className="border-b-2 border-line">
            <th scope="col" className="py-1.5 pr-3">Token</th>
            <th scope="col" className="py-1.5 pr-3">Value</th>
            <th scope="col" className="py-1.5">Use</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([token, value, use]) => (
            <tr key={token} className="border-b-2 border-line-subtle last:border-0">
              <td className="py-1.5 pr-3"><code className="font-mono">{token}</code></td>
              <td className="py-1.5 pr-3 tabular-nums">{value}</td>
              <td className="py-1.5 text-fg-muted">{use}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
