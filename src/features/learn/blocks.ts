import { z } from "zod";

/**
 * Lesson content: an ordered list of blocks (BE-CAT-02). Stored as JSON in `lessons.content`, validated
 * with these schemas whenever it is read, and rendered by `components/lesson-blocks.tsx`.
 *
 * Safe by construction (FE-SEC-02): there is no HTML anywhere. Text is plain strings that React escapes;
 * links, media and embeds are URLs checked here (same-site paths, https, and an allow-list for embeds).
 * The course editor (FE-TCH-03) must produce exactly these shapes.
 *
 * Shared by the server (reading lessons) and the browser (types): keep it free of server-only and
 * client-only code.
 */

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Block ids are short lower-case slugs.");

/** A path on this site ("/media/…") or an https URL. Never javascript:, data: or http:. */
const safeUrl = z.string().refine((value) => /^\/(?!\/)[^\s]*$/.test(value) || /^https:\/\/[^\s]+$/.test(value), "Use a site path or an https URL.");

/** Sites whose players may be embedded (sandboxed iframe). Add a host only after checking its privacy terms for children. */
export const EMBED_HOSTS = ["www.youtube-nocookie.com", "phet.colorado.edu", "www.geogebra.org", "scratch.mit.edu"] as const;

const embedUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && (EMBED_HOSTS as readonly string[]).includes(url.hostname);
    } catch {
      return false;
    }
  }, `Embeds are limited to ${EMBED_HOSTS.join(", ")}.`);

const text = z.string().trim().min(1).max(4000);

export const textBlock = z.object({
  id,
  type: z.literal("text"),
  heading: z.string().trim().max(160).optional(),
  paragraphs: z.array(text).max(20).default([]),
  /** A bulleted list after the paragraphs. */
  list: z.array(z.string().trim().min(1).max(400)).max(20).optional(),
});

export const calloutBlock = z.object({
  id,
  type: z.literal("callout"),
  tone: z.enum(["tip", "remember", "careful"]),
  text,
});

export const imageBlock = z.object({
  id,
  type: z.literal("image"),
  src: safeUrl,
  /** Required (FE-TCH-03: the editor asks for it). Empty only for purely decorative images. */
  alt: z.string().max(300),
  caption: z.string().trim().max(300).optional(),
  width: z.number().int().positive().max(4000),
  height: z.number().int().positive().max(4000),
});

export const captionTrack = z.object({
  src: safeUrl,
  /** BCP 47, e.g. "en". */
  lang: z.string().min(2).max(10),
  label: z.string().min(1).max(40),
  default: z.boolean().optional(),
});

export const videoBlock = z.object({
  id,
  type: z.literal("video"),
  title: z.string().trim().min(1).max(160),
  /** HLS playlist (.m3u8): adaptive streaming (Safari plays it natively, others through hls.js). */
  hls: safeUrl.optional(),
  /** A plain file (MP4) for browsers without HLS support and as the fallback. */
  mp4: safeUrl.optional(),
  poster: safeUrl.optional(),
  duration_seconds: z.number().positive().max(6 * 60 * 60),
  /** Captions are expected for every video (FE-A11Y-07); authors are warned when missing. */
  captions: z.array(captionTrack).max(10).default([]),
  transcript: z.string().trim().max(20_000).optional(),
}).refine((block) => block.hls || block.mp4, "A video needs an HLS playlist or an MP4 file.");

export const fileBlock = z.object({
  id,
  type: z.literal("file"),
  href: safeUrl,
  name: z.string().trim().min(1).max(160),
  /** Shown next to the link ("PDF, 42 KB"). */
  mime: z.string().max(100),
  size_bytes: z.number().int().nonnegative().max(500 * 1024 * 1024),
  description: z.string().trim().max(300).optional(),
});

export const embedBlock = z.object({
  id,
  type: z.literal("embed"),
  url: embedUrl,
  title: z.string().trim().min(1).max(160),
  /** Width / height, e.g. 16/9. */
  aspect: z.number().min(0.3).max(4).default(16 / 9),
});

/** A quick check of understanding ("interactive"): not graded, instant feedback, any number of tries. */
export const checkBlock = z
  .object({
    id,
    type: z.literal("check"),
    prompt: text,
    options: z.array(z.object({ id, text: z.string().trim().min(1).max(300) })).min(2).max(6),
    answer: id,
    explanation: z.string().trim().max(1000).optional(),
  })
  .refine((block) => block.options.some((option) => option.id === block.answer), "The answer must be one of the options.");

export const lessonBlock = z.union([textBlock, calloutBlock, imageBlock, videoBlock, fileBlock, embedBlock, checkBlock]);

export type TextBlock = z.output<typeof textBlock>;
export type CalloutBlock = z.output<typeof calloutBlock>;
export type ImageBlock = z.output<typeof imageBlock>;
export type VideoBlock = z.output<typeof videoBlock>;
export type CaptionTrack = z.output<typeof captionTrack>;
export type FileBlock = z.output<typeof fileBlock>;
export type EmbedBlock = z.output<typeof embedBlock>;
export type CheckBlock = z.output<typeof checkBlock>;
export type LessonBlock = z.output<typeof lessonBlock>;
export type LessonBlockType = LessonBlock["type"];

/**
 * The valid blocks of stored content, in order. Invalid blocks (and duplicate ids) are left out rather
 * than failing the whole lesson; `dropped` says how many, so the server can log it for authors.
 */
export function parseBlocks(content: unknown): { blocks: LessonBlock[]; dropped: number } {
  if (!Array.isArray(content)) return { blocks: [], dropped: 0 };
  const blocks: LessonBlock[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const raw of content) {
    const parsed = lessonBlock.safeParse(raw);
    if (parsed.success && !seen.has(parsed.data.id)) {
      seen.add(parsed.data.id);
      blocks.push(parsed.data);
    } else {
      dropped += 1;
    }
  }
  return { blocks, dropped };
}

/** Video blocks without captions: the authoring warning of FE-A11Y-07. */
export function videosWithoutCaptions(blocks: readonly LessonBlock[]): VideoBlock[] {
  return blocks.filter((block): block is VideoBlock => block.type === "video" && block.captions.length === 0);
}

/** A block in a few words, for notes and bookmarks listed outside the lesson ("Video: What is a fraction?"). */
export function blockLabel(block: LessonBlock): string {
  switch (block.type) {
    case "text":
      return block.heading ?? (block.paragraphs[0] ? `Text: ${block.paragraphs[0].slice(0, 60)}${block.paragraphs[0].length > 60 ? "…" : ""}` : "Text");
    case "callout":
      return { tip: "Tip", remember: "Remember", careful: "Careful" }[block.tone];
    case "image":
      return `Picture: ${block.caption ?? block.alt ?? "image"}`.slice(0, 100);
    case "video":
      return `Video: ${block.title}`;
    case "file":
      return `File: ${block.name}`;
    case "embed":
      return `Activity: ${block.title}`;
    case "check":
      return "Quick check";
  }
}

/** The lesson player's address for a spot in a lesson: the block (#block-id) and a video moment (?t=). */
export function lessonSpotHref(courseSlug: string, lessonSlug: string, blockId?: string | null, seconds?: number | null): string {
  const base = `/learn/courses/${courseSlug}/lessons/${lessonSlug}`;
  return `${base}${seconds != null ? `?t=${Math.floor(seconds)}` : ""}${blockId ? `#block-${blockId}` : ""}`;
}
