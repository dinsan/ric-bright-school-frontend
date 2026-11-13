import type { ReactNode } from "react";

/**
 * The share image (Open Graph / Twitter card) in the notebook style: graph paper, an ink-outlined card
 * with a sticker shadow, the grade tile. Rendered by next/og (Satori), which takes inline styles only
 * and no CSS variables, so the light theme's token values are repeated here.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const ink = "#0e1a3b";
const muted = "#4a5679";
const canvas = "#f5f8ff";
const grid = "#e1e9f8";
const cobalt = "#2547f5";
const marker = "#ffd23f";
const bands = {
  elementary: { bg: marker, fg: ink },
  middle: { bg: "#137a52", fg: "#ffffff" },
  high: { bg: cobalt, fg: "#ffffff" },
};

function band(grade: number) {
  return grade <= 5 ? bands.elementary : grade <= 8 ? bands.middle : bands.high;
}

export function GradeTile({ grade, size = 120 }: { grade: number; size?: number }) {
  const colours = band(grade);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size * 0.18,
        border: `4px solid ${ink}`,
        background: colours.bg,
        color: colours.fg,
        fontSize: size * (grade >= 10 ? 0.48 : 0.58),
        fontWeight: 800,
        boxShadow: `6px 6px 0 ${ink}`,
      }}
    >
      {grade}
    </div>
  );
}

export function OgCard({ eyebrow, title, subtitle, footer }: { eyebrow: string; title: string; subtitle?: string; footer?: ReactNode }) {
  const titleSize = title.length > 48 ? 56 : title.length > 28 ? 68 : 84;
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 56,
        background: canvas,
        backgroundImage: `linear-gradient(${grid} 2px, transparent 2px), linear-gradient(90deg, ${grid} 2px, transparent 2px)`,
        backgroundSize: "32px 32px",
        color: ink,
        fontFamily: "Lexend",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "48px 56px",
          background: "#ffffff",
          border: `4px solid ${ink}`,
          borderRadius: 28,
          boxShadow: `12px 12px 0 ${ink}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: cobalt, border: `3px solid ${ink}` }}>
            <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, background: marker }} />
          </div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>Lumina</div>
          <div style={{ display: "flex", marginLeft: 12, fontSize: 28, color: muted }}>{eyebrow}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          {subtitle && <div style={{ display: "flex", fontSize: 32, color: muted, lineHeight: 1.3 }}>{subtitle}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>{footer}</div>
      </div>
    </div>
  );
}
