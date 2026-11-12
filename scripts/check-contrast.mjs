#!/usr/bin/env node
/**
 * Checks the WCAG 2.2 contrast ratio of every foreground/background token pair, in every theme.
 *
 *   npm run tokens:check              # fails (exit 1) if any pair is below its minimum
 *   npm run tokens:check -- --markdown  # prints the table used in docs/design.md
 *
 * Colours are read from src/styles/tokens.css, so the check always matches what ships.
 * Only hex values are supported in colour tokens (by design: no alpha in text colours).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TOKENS = fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url));

// Minimum ratios. WCAG 2.2: 4.5:1 normal text (1.4.3), 3:1 large text and UI parts (1.4.3, 1.4.11).
// The high-contrast theme aims for AAA: 7:1 text (1.4.6) and 4.5:1 for UI parts.
const MIN = {
  light: { text: 4.5, ui: 3 },
  dark: { text: 4.5, ui: 3 },
  contrast: { text: 7, ui: 4.5 },
};

/** [foreground, background, kind, where it is used] */
const PAIRS = [
  ["fg", "canvas", "text", "Body text on the page"],
  ["fg", "surface", "text", "Text on cards, inputs, menus"],
  ["fg", "surface-sunken", "text", "Text on hover / muted areas"],
  ["fg-muted", "canvas", "text", "Secondary text on the page"],
  ["fg-muted", "surface", "text", "Secondary text, hints, placeholders"],
  ["fg-muted", "surface-sunken", "text", "Secondary text on muted areas"],
  ["link", "canvas", "text", "Links on the page"],
  ["link", "surface", "text", "Links on cards"],
  ["primary-fg", "primary", "text", "Primary button label"],
  ["accent-fg", "accent", "text", "Highlighter / marker label"],
  ["inverse-fg", "inverse", "text", "Selected chips, tooltips"],
  ["success-fg", "success", "text", "Success badge / solid"],
  ["warning-fg", "warning", "text", "Warning badge / solid"],
  ["danger-fg", "danger", "text", "Danger button label"],
  ["info-soft-fg", "info-soft", "text", "Info alert text"],
  ["success-soft-fg", "success-soft", "text", "Success alert text"],
  ["warning-soft-fg", "warning-soft", "text", "Warning alert text"],
  ["danger-soft-fg", "danger-soft", "text", "Danger alert text"],
  ["danger-text", "surface", "text", "Field error message on cards"],
  ["danger-text", "canvas", "text", "Field error message on the page"],
  ["band-elementary-fg", "band-elementary", "text", "Grades 1–5 tile"],
  ["band-middle-fg", "band-middle", "text", "Grades 6–8 tile"],
  ["band-high-fg", "band-high", "text", "Grades 9–12 tile"],
  ["line", "canvas", "ui", "Borders of controls on the page"],
  ["line", "surface", "ui", "Borders of controls on cards"],
  ["focus", "canvas", "ui", "Focus ring on the page"],
  ["focus", "surface", "ui", "Focus ring on cards"],
  ["primary", "canvas", "ui", "Primary button against the page"],
  ["primary", "surface", "ui", "Checked checkbox / switch / progress fill"],
  ["danger", "surface", "ui", "Invalid field border"],
  ["line", "surface-sunken", "ui", "Unchecked switch track border"],
];

// --- Parse tokens.css ------------------------------------------------------------------
function parseBlocks(css) {
  const blocks = new Map();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const [, selector, body] of clean.matchAll(re)) {
    const decls = {};
    for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) decls[name] = value.trim();
    for (const sel of selector.split(",").map((s) => s.trim())) {
      blocks.set(sel, { ...(blocks.get(sel) ?? {}), ...decls });
    }
  }
  return blocks;
}

function themeVars(blocks, theme) {
  const root = blocks.get(":root") ?? {};
  const own = theme === "light" ? {} : (blocks.get(`[data-theme="${theme}"]`) ?? {});
  return { ...root, ...own };
}

function resolve(vars, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular token: --${name}`);
  seen.add(name);
  const value = vars[name];
  if (value === undefined) throw new Error(`Missing token: --${name}`);
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  return ref ? resolve(vars, ref[1], seen) : value;
}

// --- WCAG maths -----------------------------------------------------------------------
function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// --- Run -----------------------------------------------------------------------------
const blocks = parseBlocks(readFileSync(TOKENS, "utf8"));
const markdown = process.argv.includes("--markdown");
const themes = Object.keys(MIN);
const rows = [];
let failures = 0;

for (const [fg, bg, kind, usage] of PAIRS) {
  const cells = themes.map((theme) => {
    const vars = themeVars(blocks, theme);
    const ratio = contrast(resolve(vars, fg), resolve(vars, bg));
    const min = MIN[theme][kind];
    const ok = ratio >= min;
    if (!ok) failures += 1;
    return { theme, ratio, min, ok, fgHex: resolve(vars, fg), bgHex: resolve(vars, bg) };
  });
  rows.push({ fg, bg, kind, usage, cells });
}

if (markdown) {
  console.log(`| Foreground | Background | Used for | ${themes.map((t) => `${t} (min ${MIN[t].text}/${MIN[t].ui})`).join(" | ")} |`);
  console.log(`| --- | --- | --- | ${themes.map(() => "---").join(" | ")} |`);
  for (const r of rows) {
    const cells = r.cells.map((c) => `${c.ratio.toFixed(2)}${c.ok ? "" : " ❌"}`).join(" | ");
    console.log(`| \`${r.fg}\` | \`${r.bg}\` | ${r.usage} (${r.kind}) | ${cells} |`);
  }
} else {
  for (const r of rows) {
    for (const c of r.cells) {
      const mark = c.ok ? "ok  " : "FAIL";
      console.log(
        `${mark} ${c.theme.padEnd(8)} ${`${r.fg} on ${r.bg}`.padEnd(40)} ${c.ratio.toFixed(2).padStart(5)} (min ${c.min}, ${r.kind})  ${c.fgHex} / ${c.bgHex}`,
      );
    }
  }
  console.log(failures ? `\n${failures} pair(s) below the minimum.` : `\nAll ${rows.length * themes.length} pairs pass.`);
}
process.exit(failures ? 1 : 0);
