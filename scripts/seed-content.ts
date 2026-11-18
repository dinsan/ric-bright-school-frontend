/**
 * Lesson content for the seed catalog (scripts/db-seed.ts), in the block format of
 * src/features/learn/blocks.ts. "Fractions Made Simple" is written out by hand and uses every block type
 * with real media in public/media/lessons/ (a 24-second video as HLS and MP4 with captions, an
 * illustration, a worksheet PDF). Every other lesson gets a short generated lesson from its summary, so
 * the whole catalog can be clicked through.
 */
import { lessonBlock } from "../src/features/learn/blocks";
import type { LessonSeed } from "./seed-lessons";

type Block = Record<string, unknown>;

const media = (lesson: string, file: string) => `/media/lessons/${lesson}/${file}`;

const FRACTIONS: Record<string, Block[]> = {
  "what-is-a-fraction": [
    {
      id: "intro",
      type: "text",
      heading: "Parts of a whole",
      paragraphs: [
        "Imagine a pizza cut into equal slices. Each slice is a part of the whole pizza. A fraction is a way to write down how many of those equal parts you have.",
        "Watch the short video, then try the question below it.",
      ],
    },
    {
      id: "video",
      type: "video",
      title: "What is a fraction?",
      hls: media("what-is-a-fraction", "master.m3u8"),
      mp4: media("what-is-a-fraction", "video.mp4"),
      poster: media("what-is-a-fraction", "poster.jpg"),
      duration_seconds: 24,
      captions: [{ src: media("what-is-a-fraction", "captions.en.vtt"), lang: "en", label: "English", default: true }],
      transcript:
        "What is a fraction? A fraction is a part of a whole. Split the whole into two equal parts: one part is one half, 1/2. Split it into four equal parts: one part is one quarter, 1/4. Two quarters are the same as one half: 2/4 = 1/2.",
    },
    { id: "remember", type: "callout", tone: "remember", text: "The parts must be equal. A cake cut into one big piece and one small piece is not cut into halves." },
    {
      id: "check",
      type: "check",
      prompt: "A circle is split into 4 equal parts and 1 part is coloured. What fraction is coloured?",
      options: [
        { id: "half", text: "1/2" },
        { id: "quarter", text: "1/4" },
        { id: "four", text: "4/1" },
      ],
      answer: "quarter",
      explanation: "There are 4 equal parts and 1 is coloured, so one quarter: 1/4.",
    },
    {
      id: "worksheet",
      type: "file",
      href: media("what-is-a-fraction", "worksheet.pdf"),
      name: "Worksheet: halves and quarters",
      mime: "application/pdf",
      size_bytes: 1521,
      description: "Print it and colour the shapes.",
    },
  ],
  "equivalent-fractions": [
    {
      id: "intro",
      type: "text",
      heading: "Different names, same amount",
      paragraphs: ["Some fractions look different but are the same amount. They are called equivalent fractions. A fraction wall shows them side by side."],
    },
    {
      id: "wall",
      type: "image",
      src: media("equivalent-fractions", "fraction-wall.svg"),
      alt: "A fraction wall: one whole bar, then 2 halves, 4 quarters and 8 eighths underneath, all the same total length.",
      caption: "Each row is the same length: 1 = 2/2 = 4/4 = 8/8.",
      width: 640,
      height: 300,
    },
    {
      id: "how",
      type: "text",
      heading: "Spot them on the wall",
      paragraphs: ["Put your finger at the end of one half. Go straight down: the same line ends two quarters, and four eighths."],
      list: ["1/2 = 2/4 = 4/8", "1/4 = 2/8", "3/4 = 6/8"],
    },
    { id: "tip", type: "callout", tone: "tip", text: "Multiply the top and the bottom by the same number and you get an equivalent fraction: 1/2 = 2/4 (both × 2)." },
    {
      id: "check",
      type: "check",
      prompt: "Which fraction is equivalent to 1/2?",
      options: [
        { id: "a", text: "2/3" },
        { id: "b", text: "3/6" },
        { id: "c", text: "1/4" },
      ],
      answer: "b",
      explanation: "3/6 is three of six equal parts: exactly half. Both the top and the bottom of 1/2 were multiplied by 3.",
    },
  ],
  "comparing-fractions": [
    {
      id: "intro",
      type: "text",
      heading: "Which is bigger?",
      paragraphs: [
        "When the top numbers are the same, look at the bottom number. The more equal parts the whole is cut into, the smaller each part is.",
        "So 1/3 is bigger than 1/5: a cake shared by three is a bigger slice than a cake shared by five.",
      ],
    },
    { id: "careful", type: "callout", tone: "careful", text: "A bigger bottom number does not mean a bigger fraction. 1/8 is smaller than 1/2." },
    {
      id: "check",
      type: "check",
      prompt: "Which is the biggest?",
      options: [
        { id: "a", text: "1/10" },
        { id: "b", text: "1/3" },
        { id: "c", text: "1/6" },
      ],
      answer: "b",
      explanation: "All three have 1 on top. Thirds are the biggest parts, because the whole is cut into the fewest pieces.",
    },
  ],
  "adding-and-subtracting-fractions": [
    {
      id: "intro",
      type: "text",
      heading: "Same bottom number? Add the tops",
      paragraphs: [
        "When fractions have the same denominator (the bottom number), the parts are the same size. Add or subtract the numerators (the top numbers) and keep the denominator.",
        "1/5 + 2/5 = 3/5. On a number line from 0 to 1 in fifths: start at 1/5 and jump 2 fifths.",
      ],
    },
    { id: "tip", type: "callout", tone: "tip", text: "Keep the bottom number the same: the size of the parts doesn't change when you add them." },
    {
      id: "check",
      type: "check",
      prompt: "What is 5/8 − 2/8?",
      options: [
        { id: "a", text: "3/8" },
        { id: "b", text: "3/0" },
        { id: "c", text: "7/8" },
      ],
      answer: "a",
      explanation: "Take 2 eighths away from 5 eighths: 3 eighths are left, 3/8.",
    },
  ],
};

/** A short lesson from the seed's title and summary, with a check that tells it apart from its siblings. */
function generated(courseTitle: string, lesson: LessonSeed, siblings: LessonSeed[]): Block[] {
  const [title, summary, minutes] = lesson;
  const others = siblings.filter((other) => other[0] !== title).slice(0, 2);
  return [
    {
      id: "intro",
      type: "text",
      heading: title,
      paragraphs: [summary, `This lesson of ${courseTitle} takes about ${minutes} minutes. Read it through, try the question, then press Done.`],
    },
    { id: "tip", type: "callout", tone: "tip", text: "Stuck? Go back to the previous lesson in the outline: every lesson builds on the one before." },
    {
      id: "check",
      type: "check",
      prompt: `What is the lesson “${title}” about?`,
      options: [{ id: "this", text: summary }, ...others.map((other, index) => ({ id: `other-${index + 1}`, text: other[1] }))],
      answer: "this",
      explanation: `“${title}” is about this: ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`,
    },
  ];
}

/** The content blocks for a seeded lesson. Validated here, so a mistake in the seed fails loudly. */
export function lessonContent(courseSlug: string, courseTitle: string, lessonSlug: string, lesson: LessonSeed, siblings: LessonSeed[]): Block[] {
  const blocks = (courseSlug === "fractions-made-simple" ? FRACTIONS[lessonSlug] : undefined) ?? generated(courseTitle, lesson, siblings);
  for (const block of blocks) {
    const parsed = lessonBlock.safeParse(block);
    if (!parsed.success) throw new Error(`Seed content ${courseSlug}/${lessonSlug}#${String(block.id)}: ${parsed.error.message}`);
  }
  return blocks;
}
