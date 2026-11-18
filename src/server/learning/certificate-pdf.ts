import "server-only";

import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Certificate } from "@/features/learn/contract";

/**
 * The certificate of completion as a PDF (FE-STU-08): A4 landscape, the notebook style of the site
 * (ink, cobalt, marker yellow), Lexend embedded (subset) so it prints the same everywhere. Drawn with
 * pdf-lib, in pure JavaScript: no headless browser on the server.
 *
 * Keep it in step with the on-screen preview (src/features/learn/components/certificate-view.tsx).
 */

// The light theme's token values (PDFs have no CSS variables; same values as the share images).
const hex = (value: string) => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
const INK = hex("#0e1a3b");
const MUTED = hex("#4a5679");
const COBALT = hex("#2547f5");
const MARKER = hex("#ffd23f");
const PAPER = hex("#ffffff");
const CANVAS = hex("#f5f8ff");
const GRID = hex("#e1e9f8");

// Literal paths so Next.js copies the files into the standalone output (as for the share images).
const fonts = Promise.all([
  readFile(join(process.cwd(), "src/app/fonts/og/lexend-400.ttf")),
  readFile(join(process.cwd(), "src/app/fonts/og/lexend-800.ttf")),
]);

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });

/** The largest size (down to `min`) at which `text` fits in `width`. */
function fitSize(font: PDFFont, text: string, width: number, max: number, min: number): number {
  let size = max;
  while (size > min && font.widthOfTextAtSize(text, size) > width) size -= 1;
  return size;
}

type Color = ReturnType<typeof rgb>;

/** Words of `text` in lines no wider than `width` at `size` (a single over-long word keeps its own line). */
function wrap(font: PDFFont, text: string, width: number, size: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && font.widthOfTextAtSize(`${last} ${word}`, size) <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/**
 * Centered text on one line, shrinking from `max` to `min` to fit; if it still doesn't fit, on two lines
 * at the size that fits. Never cut: a name on a certificate is printed in full. Returns the baseline of
 * the last line drawn.
 */
function centered(page: PDFPage, text: string, y: number, font: PDFFont, { max, min = max, color = INK, width = 640, leading = 1.15 }: { max: number; min?: number; color?: Color; width?: number; leading?: number }): number {
  const draw = (line: string, size: number, at: number) =>
    page.drawText(line, { x: (page.getWidth() - font.widthOfTextAtSize(line, size)) / 2, y: at, size, font, color });
  const size = fitSize(font, text, width, max, min);
  if (font.widthOfTextAtSize(text, size) <= width) {
    draw(text, size, y);
    return y;
  }
  // Two lines, as large as they fit (down to 10 pt), centred around the one-line position.
  let twoLineSize = min;
  let lines = wrap(font, text, width, twoLineSize);
  while ((lines.length > 2 || lines.some((line) => font.widthOfTextAtSize(line, twoLineSize) > width)) && twoLineSize > 10) {
    twoLineSize -= 1;
    lines = wrap(font, text, width, twoLineSize);
  }
  const step = twoLineSize * leading;
  const top = y + step / 2;
  lines.forEach((line, index) => draw(line, twoLineSize, top - index * step));
  return top - (lines.length - 1) * step;
}

export async function certificatePdf(certificate: Certificate): Promise<Uint8Array> {
  const [regularBytes, boldBytes] = await fonts;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  pdf.setTitle(`Certificate: ${certificate.course_title}`);
  pdf.setAuthor("Lumina");
  pdf.setSubject(`${certificate.student_name} completed ${certificate.course_title}`);
  pdf.setCreator("Lumina");
  pdf.setCreationDate(new Date(certificate.issued_at));

  const page = pdf.addPage([841.89, 595.28]); // A4 landscape, in points
  const { width, height } = page.getSize();

  // Graph paper, then the sheet with a thick ink border and a sticker shadow.
  page.drawRectangle({ x: 0, y: 0, width, height, color: CANVAS });
  for (let x = 0; x <= width; x += 24) page.drawLine({ start: { x, y: 0 }, end: { x, y: height }, thickness: 0.5, color: GRID });
  for (let y = 0; y <= height; y += 24) page.drawLine({ start: { x: 0, y }, end: { x: width, y }, thickness: 0.5, color: GRID });
  page.drawRectangle({ x: 44, y: 32, width: width - 80, height: height - 80, color: INK });
  page.drawRectangle({ x: 36, y: 40, width: width - 80, height: height - 80, color: PAPER, borderColor: INK, borderWidth: 3 });
  page.drawRectangle({ x: 52, y: 56, width: width - 112, height: height - 112, borderColor: COBALT, borderWidth: 1.2 });

  // The Lumina mark: a cobalt tile with a marker-yellow dot, and the name.
  const markX = width / 2 - 62;
  const markY = height - 112;
  page.drawRectangle({ x: markX, y: markY, width: 28, height: 28, color: COBALT, borderColor: INK, borderWidth: 2 });
  page.drawCircle({ x: markX + 14, y: markY + 14, size: 6, color: MARKER, borderColor: INK, borderWidth: 1.5 });
  page.drawText("Lumina", { x: markX + 38, y: markY + 6, size: 22, font: bold, color: INK });

  centered(page, "CERTIFICATE OF COMPLETION", height - 160, bold, { max: 15, color: COBALT });
  centered(page, "This certifies that", height - 206, regular, { max: 16, color: MUTED });
  const nameBaseline = centered(page, certificate.student_name, height - 262, bold, { max: 44, min: 24 });
  // Marker underline under the name.
  page.drawRectangle({ x: width / 2 - 150, y: nameBaseline - 14, width: 300, height: 6, color: MARKER });
  centered(page, "has completed every lesson of", height - 314, regular, { max: 16, color: MUTED });
  const titleBaseline = centered(page, certificate.course_title, height - 358, bold, { max: 30, min: 18 });
  centered(page, `Grade ${certificate.grade_level} · ${certificate.subject_name} · ${certificate.lessons_count} ${certificate.lessons_count === 1 ? "lesson" : "lessons"}`, titleBaseline - 32, regular, {
    max: 13,
    color: MUTED,
  });

  // Date on the left, certificate number on the right.
  const footerY = 96;
  const issued = dateFormatter.format(new Date(certificate.issued_at));
  page.drawLine({ start: { x: 120, y: footerY + 22 }, end: { x: 330, y: footerY + 22 }, thickness: 1.5, color: INK });
  page.drawText(issued, { x: 120, y: footerY + 30, size: 13, font: bold, color: INK });
  page.drawText("Date", { x: 120, y: footerY + 6, size: 10, font: regular, color: MUTED });
  page.drawLine({ start: { x: width - 330, y: footerY + 22 }, end: { x: width - 120, y: footerY + 22 }, thickness: 1.5, color: INK });
  page.drawText(certificate.code, { x: width - 330, y: footerY + 30, size: 13, font: bold, color: INK });
  page.drawText("Certificate number", { x: width - 330, y: footerY + 6, size: 10, font: regular, color: MUTED });

  return pdf.save();
}

/** A file name without the student's name (it may be shared or synced): lumina-certificate-fractions-made-simple.pdf */
export function certificateFileName(certificate: Certificate): string {
  const slug = certificate.course_title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 60);
  return `lumina-certificate-${slug || "course"}.pdf`;
}
