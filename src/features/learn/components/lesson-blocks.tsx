"use client";

import { Bookmark, Check, Download, FileText, Lightbulb, TriangleAlert, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { CalloutBlock, CheckBlock, EmbedBlock, FileBlock, ImageBlock, LessonBlock, TextBlock } from "../blocks";
import { usePlayful } from "./celebration";
import { VideoPlayer } from "./video-player";

/**
 * Renders lesson content blocks (src/features/learn/blocks.ts). Text is plain strings that React
 * escapes: no HTML is ever injected (FE-SEC-02). Headings start at h2 (the lesson title is the h1).
 */
export function LessonBlocks({
  blocks,
  mediaPositions = {},
  onMediaPosition,
  onBookmarkMoment,
  moments = {},
  jump,
}: {
  blocks: LessonBlock[];
  mediaPositions?: Record<string, number>;
  onMediaPosition?: (blockId: string, seconds: number) => void;
  /** Offers "Bookmark this moment" under videos. */
  onBookmarkMoment?: (blockId: string, seconds: number) => void;
  /** Bookmarked moments per video block. */
  moments?: Record<string, Array<{ id: string; seconds: number; label?: string | null }>>;
  /** Jump a video to a moment (from a bookmark). */
  jump?: { blockId: string; seconds: number; key: number } | null;
}) {
  return (
    <div className="grid gap-8">
      {blocks.map((block) => (
        <section key={block.id} id={`block-${block.id}`} className="scroll-mt-24">
          {block.type === "text" ? (
            <TextContent block={block} />
          ) : block.type === "callout" ? (
            <Callout block={block} />
          ) : block.type === "image" ? (
            <Figure block={block} />
          ) : block.type === "video" ? (
            <VideoPlayer
              video={block}
              startAt={mediaPositions[block.id]}
              onPosition={(seconds) => onMediaPosition?.(block.id, seconds)}
              onBookmark={onBookmarkMoment ? (seconds) => onBookmarkMoment(block.id, seconds) : undefined}
              moments={moments[block.id]}
              jumpTo={jump?.blockId === block.id ? { seconds: jump.seconds, key: jump.key } : null}
            />
          ) : block.type === "file" ? (
            <FileLink block={block} />
          ) : block.type === "embed" ? (
            <Embed block={block} />
          ) : (
            <QuickCheck block={block} />
          )}
        </section>
      ))}
    </div>
  );
}

function TextContent({ block }: { block: TextBlock }) {
  return (
    <div className="grid max-w-prose gap-3">
      {block.heading && <h2 className="text-heading">{block.heading}</h2>}
      {block.paragraphs.map((paragraph, index) => (
        <p key={index} className="text-lead leading-relaxed">
          {paragraph}
        </p>
      ))}
      {block.list && (
        <ul className="grid list-disc gap-1 pl-6 text-lead">
          {block.list.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const calloutStyle = {
  tip: { label: "Tip", icon: Lightbulb, className: "bg-accent text-accent-fg" },
  remember: { label: "Remember", icon: Bookmark, className: "bg-info-soft text-info-soft-fg" },
  careful: { label: "Careful", icon: TriangleAlert, className: "bg-warning-soft text-warning-soft-fg" },
} as const;

function Callout({ block }: { block: CalloutBlock }) {
  const style = calloutStyle[block.tone];
  const Icon = style.icon;
  return (
    <aside aria-label={style.label} className={cn("flex max-w-prose gap-3 rounded-card border-2 border-line p-card", style.className)}>
      <Icon aria-hidden className="mt-0.5 size-icon shrink-0" />
      <p>
        <strong>{style.label}: </strong>
        {block.text}
      </p>
    </aside>
  );
}

function Figure({ block }: { block: ImageBlock }) {
  return (
    <figure className="grid gap-2">
      {/* Plain <img>: sizes are known (no layout shift) and SVG illustrations stay crisp. Responsive variants: FE-PERF-02. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.src}
        alt={block.alt}
        width={block.width}
        height={block.height}
        loading="lazy"
        decoding="async"
        className="h-auto w-full rounded-card border-2 border-line bg-surface"
      />
      {block.caption && <figcaption className="text-small text-fg-muted">{block.caption}</figcaption>}
    </figure>
  );
}

/** "PDF, 42 KB" */
export function describeFile(mime: string, bytes: number): string {
  const kind = mime === "application/pdf" ? "PDF" : mime.startsWith("image/") ? "Image" : mime.split("/")[1]?.toUpperCase() ?? "File";
  const size = bytes < 1024 ? `${bytes} bytes` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${kind}, ${size}`;
}

function FileLink({ block }: { block: FileBlock }) {
  return (
    <a
      href={block.href}
      download
      className="flex max-w-prose items-center gap-3 rounded-card border-2 border-line bg-surface p-4 shadow-sticker transition-transform duration-fast hover:-translate-y-0.5"
    >
      <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border-2 border-line bg-accent text-accent-fg">
        <FileText className="size-5" />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="font-bold">{block.name}</span>
        <span className="text-small text-fg-muted">
          {describeFile(block.mime, block.size_bytes)}
          {block.description ? ` · ${block.description}` : ""}
        </span>
      </span>
      <Download aria-hidden className="size-icon shrink-0" />
      <span className="sr-only">(download)</span>
    </a>
  );
}

function Embed({ block }: { block: EmbedBlock }) {
  return (
    <figure className="grid gap-2">
      <div className="overflow-hidden rounded-card border-2 border-line bg-surface" style={{ aspectRatio: String(block.aspect) }}>
        {/* Sandboxed, lazy, no referrer; only hosts on the allow-list ever get here (blocks.ts). */}
        <iframe
          src={block.url}
          title={block.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="fullscreen"
          className="size-full"
        />
      </div>
      <figcaption className="text-small text-fg-muted">{block.title}</figcaption>
    </figure>
  );
}

/** A quick check: pick an answer, press Check, get feedback; try again as often as you like. */
export function QuickCheck({ block }: { block: CheckBlock }) {
  const ids = useId();
  const playful = usePlayful();
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [tries, setTries] = useState(0);
  return (
    <form
      className="grid max-w-prose gap-4 rounded-card border-2 border-line bg-surface p-card shadow-sticker"
      onSubmit={(event) => {
        event.preventDefault();
        if (!choice) return;
        setTries((count) => count + 1);
        setResult(choice === block.answer ? "correct" : "wrong");
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-3 font-bold">
          <span className="mb-1 block text-caption uppercase tracking-wide text-fg-muted">Quick check</span>
          {block.prompt}
        </legend>
        {block.options.map((option) => (
          <label
            key={option.id}
            htmlFor={`${ids}-${option.id}`}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-control border-2 px-3 py-2",
              choice === option.id ? "border-line bg-surface-sunken" : "border-line-subtle",
              result === "correct" && option.id === block.answer && "border-success bg-success-soft",
            )}
          >
            <input
              id={`${ids}-${option.id}`}
              type="radio"
              name={`${ids}-choice`}
              value={option.id}
              checked={choice === option.id}
              onChange={() => {
                setChoice(option.id);
                if (result === "wrong") setResult(null);
              }}
              className="size-5 accent-primary"
            />
            {option.text}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!choice || result === "correct"}>
          Check
        </Button>
        <p role="status" aria-live="polite" className="min-h-6 flex-1">
          {result === "correct" && (
            <span className="flex items-start gap-2">
              <Check aria-hidden className={cn("mt-0.5 size-5 shrink-0 text-success", playful && "animate-celebrate")} />
              <span>
                <strong>{tries === 1 ? "Yes, first try!" : "Yes, that's it!"}</strong> {block.explanation}
              </span>
            </span>
          )}
          {result === "wrong" && (
            <span className="flex items-start gap-2">
              <X aria-hidden className="mt-0.5 size-5 shrink-0 text-danger-text" />
              <span>
                <strong>Not quite.</strong> Have another look and try again.
              </span>
            </span>
          )}
        </p>
      </div>
    </form>
  );
}
