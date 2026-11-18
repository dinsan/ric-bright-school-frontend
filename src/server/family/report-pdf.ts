import "server-only";

import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { describeControls, formatMinutes } from "@/features/learn/controls";
import type { ChildProgress } from "@/features/family/contract";
import { scoreText } from "@/features/family/insights";

/**
 * A child's learning report for their parent, as a PDF (FE-PAR-02 "report card download"): A4 portrait,
 * the site's style, Lexend embedded (subset), drawn with pdf-lib on the server (no headless browser).
 * Made from the same data as the child's page (ChildProgress), for a period of 7, 30 or 90 days.
 * Tables continue on the next page with their header repeated; every page has a footer with its number.
 */

const hex = (value: string) => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
const INK = hex("#0e1a3b");
const MUTED = hex("#4a5679");
const COBALT = hex("#2547f5");
const MARKER = hex("#ffd23f");
const PAPER = hex("#ffffff");
const CANVAS = hex("#f5f8ff");
const LINE = hex("#c9d4ec");

// Literal paths so Next.js copies the files into the standalone output (as for the certificates).
const fonts = Promise.all([readFile(join(process.cwd(), "src/app/fonts/og/lexend-400.ttf")), readFile(join(process.cwd(), "src/app/fonts/og/lexend-800.ttf"))]);

const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT = WIDTH - MARGIN * 2;
const FOOTER = 40;

const dateText = (iso: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));

type Color = ReturnType<typeof rgb>;

class Writer {
  readonly pages: PDFPage[] = [];
  page!: PDFPage;
  y = 0;
  private readonly charset: Set<number>;

  constructor(
    readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.charset = new Set(regular.getCharacterSet());
    this.addPage();
  }

  /** Characters the font lacks become "?" rather than breaking the file. */
  clean(text: string): string {
    return [...text.replace(/\s+/g, " ")].map((char) => (this.charset.has(char.codePointAt(0)!) ? char : "?")).join("");
  }

  addPage() {
    this.page = this.doc.addPage([WIDTH, HEIGHT]);
    this.pages.push(this.page);
    this.y = HEIGHT - MARGIN;
  }

  /** Start a new page unless `height` still fits above the footer. */
  need(height: number) {
    if (this.y - height < MARGIN + FOOTER) this.addPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const word of this.clean(text).split(" ")) {
      const last = lines.at(-1);
      if (last !== undefined && font.widthOfTextAtSize(`${last} ${word}`, size) <= width) lines[lines.length - 1] = `${last} ${word}`;
      else if (font.widthOfTextAtSize(word, size) <= width) lines.push(word);
      else {
        // A word longer than the line (a long code, a URL): break it.
        let piece = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(piece + char, size) > width && piece) {
            lines.push(piece);
            piece = "";
          }
          piece += char;
        }
        lines.push(piece);
      }
    }
    return lines.length ? lines : [""];
  }

  text(text: string, { size = 10, font = this.regular, color = INK, indent = 0, gap = 4, width = CONTENT - indent }: { size?: number; font?: PDFFont; color?: Color; indent?: number; gap?: number; width?: number } = {}) {
    const leading = size * 1.35;
    for (const line of this.wrap(text, font, size, width)) {
      this.need(leading);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color });
      this.y -= leading;
    }
    this.y -= gap;
  }

  heading(text: string) {
    this.need(60); // a heading never sits alone at the bottom of a page
    this.y -= 10;
    this.page.drawRectangle({ x: MARGIN, y: this.y - 16, width: 6, height: 16, color: MARKER });
    this.page.drawText(this.clean(text), { x: MARGIN + 14, y: this.y - 14, size: 14, font: this.bold, color: INK });
    this.y -= 26;
  }

  bullets(items: string[], empty: string) {
    if (!items.length) return this.text(empty, { color: MUTED });
    for (const item of items) {
      this.need(14);
      this.page.drawText("•", { x: MARGIN + 4, y: this.y - 10, size: 10, font: this.bold, color: COBALT });
      this.text(item, { indent: 16, gap: 2 });
    }
    this.y -= 2;
  }

  /** A table: column widths are fractions of the content width. Rows wrap; the header repeats on a new page. */
  table(columns: Array<{ label: string; width: number; align?: "right" }>, rows: string[][], empty: string) {
    if (!rows.length) return this.text(empty, { color: MUTED });
    const size = 9;
    const leading = size * 1.35;
    const pad = 5;
    const widths = columns.map((column) => column.width * CONTENT);
    const drawRow = (cells: string[], font: PDFFont, fill?: Color) => {
      const lines = cells.map((cell, index) => this.wrap(cell, font, size, widths[index]! - pad * 2));
      const height = Math.max(...lines.map((cell) => cell.length)) * leading + pad * 2;
      return { height, draw: () => {
        if (fill) this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: CONTENT, height, color: fill });
        let x = MARGIN;
        lines.forEach((cell, index) => {
          cell.forEach((line, lineIndex) => {
            const width = widths[index]!;
            const textX = columns[index]!.align === "right" ? x + width - pad - font.widthOfTextAtSize(line, size) : x + pad;
            this.page.drawText(line, { x: textX, y: this.y - pad - size - lineIndex * leading + 2, size, font, color: INK });
          });
          x += widths[index]!;
        });
        this.page.drawLine({ start: { x: MARGIN, y: this.y - height }, end: { x: MARGIN + CONTENT, y: this.y - height }, thickness: 0.75, color: LINE });
        this.y -= height;
      } };
    };
    const header = () => drawRow(columns.map((column) => column.label), this.bold, CANVAS);
    let head = header();
    this.need(head.height + 20);
    head.draw();
    for (const cells of rows) {
      const row = drawRow(cells, this.regular);
      if (this.y - row.height < MARGIN + FOOTER) {
        this.addPage();
        head = header();
        head.draw();
      }
      row.draw();
    }
    this.y -= 8;
  }
}

/** The period's learning time: per day up to 14 days, per week (7-day blocks, newest last) beyond. */
function learningTimeRows(report: ChildProgress): string[][] {
  if (report.period.days <= 14) {
    return report.learning_days.map((row) => [dateText(row.day), row.minutes ? formatMinutes(row.minutes) : "-", String(row.lessons_completed || "-")]);
  }
  const rows: string[][] = [];
  for (let start = 0; start < report.learning_days.length; start += 7) {
    const week = report.learning_days.slice(start, start + 7);
    const minutes = week.reduce((sum, row) => sum + row.minutes, 0);
    const lessons = week.reduce((sum, row) => sum + row.lessons_completed, 0);
    rows.push([`${dateText(week[0]!.day)} to ${dateText(week.at(-1)!.day)}`, minutes ? formatMinutes(minutes) : "-", String(lessons || "-")]);
  }
  return rows;
}

const statusText = { done: "Done", in_progress: "In progress", not_started: "Not started" } as const;

export async function childReportPdf(report: ChildProgress): Promise<Uint8Array> {
  const [regularBytes, boldBytes] = await fonts;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const name = report.child.display_name;
  doc.setTitle(`Learning report: ${name}`);
  doc.setAuthor("Lumina");
  doc.setCreator("Lumina");
  doc.setCreationDate(new Date(report.generated_at));
  const w = new Writer(doc, await doc.embedFont(regularBytes, { subset: true }), await doc.embedFont(boldBytes, { subset: true }));

  // Title band.
  w.page.drawRectangle({ x: 0, y: HEIGHT - 96, width: WIDTH, height: 96, color: COBALT });
  w.page.drawText("Lumina", { x: MARGIN, y: HEIGHT - 56, size: 24, font: w.bold, color: PAPER });
  const label = "Learning report";
  w.page.drawText(label, { x: WIDTH - MARGIN - w.regular.widthOfTextAtSize(label, 12), y: HEIGHT - 52, size: 12, font: w.regular, color: PAPER });
  w.y = HEIGHT - 96 - 28;
  w.text(name, { size: 24, font: w.bold, gap: 2 });
  const period = `${dateText(report.period.from)} to ${dateText(report.period.to)} (last ${report.period.days} days)`;
  w.text(`${report.child.grade_level ? `Grade ${report.child.grade_level} · ` : ""}${period} · made on ${dateText(report.generated_at)}`, { color: MUTED, gap: 14 });

  // The period in four numbers.
  const boxes = [
    ["Learning time", report.period.minutes ? formatMinutes(report.period.minutes) : "None"],
    ["Days with learning", String(report.period.active_days)],
    ["Lessons finished", String(report.period.lessons_completed)],
    ["Quizzes finished", String(report.period.quizzes_finished)],
  ];
  const boxWidth = (CONTENT - 3 * 10) / 4;
  w.need(64);
  boxes.forEach(([title, value], index) => {
    const x = MARGIN + index * (boxWidth + 10);
    w.page.drawRectangle({ x, y: w.y - 56, width: boxWidth, height: 56, color: CANVAS, borderColor: INK, borderWidth: 1.5 });
    w.page.drawText(w.clean(title!), { x: x + 10, y: w.y - 20, size: 9, font: w.regular, color: MUTED });
    w.page.drawText(w.clean(value!), { x: x + 10, y: w.y - 43, size: 16, font: w.bold, color: INK });
  });
  w.y -= 70;
  const s = report.summary;
  w.text(
    `All time: ${s.lessons_completed} ${s.lessons_completed === 1 ? "lesson" : "lessons"} finished, ${s.courses_completed} ${s.courses_completed === 1 ? "course" : "courses"} finished, level ${s.level} (${s.xp} XP), ${s.badges_earned} ${s.badges_earned === 1 ? "badge" : "badges"}. Streak: ${s.streak_days} ${s.streak_days === 1 ? "day" : "days"} (longest ${s.longest_streak_days}).${s.quiz_average_percent !== null ? ` Quiz average: ${s.quiz_average_percent}%.` : ""}`,
    { gap: 6 },
  );

  w.heading("Doing well");
  w.bullets(report.insights.doing_well, "Nothing to point out yet.");
  w.heading("Worth practising");
  w.bullets(report.insights.to_practise, "Nothing stands out. Keep going.");

  w.heading("Courses");
  w.table(
    [
      { label: "Course", width: 0.42 },
      { label: "Subject", width: 0.18 },
      { label: "Lessons", width: 0.14, align: "right" },
      { label: "Progress", width: 0.26 },
    ],
    report.courses.map((course) => [
      course.title,
      course.subject,
      `${course.lessons_completed} of ${course.lessons_total}`,
      course.completed_at ? `Finished ${dateText(course.completed_at)}` : `${course.percent}%${course.next_lesson ? `, next: ${course.next_lesson}` : ""}`,
    ]),
    "No courses started yet.",
  );

  w.heading("Quiz results");
  w.table(
    [
      { label: "Quiz", width: 0.34 },
      { label: "Course", width: 0.28 },
      { label: "Result", width: 0.23 },
      { label: "Date", width: 0.15 },
    ],
    report.quizzes.map((row) => [
      row.quiz,
      row.course,
      `${scoreText(row)}${row.status === "submitted" && row.pending_review ? `, ${row.pending_review} written not marked` : ""}`,
      dateText(row.submitted_at ?? row.started_at),
    ]),
    "No quizzes taken yet.",
  );

  w.heading("Work set by teachers");
  w.table(
    [
      { label: "Work", width: 0.38 },
      { label: "Class", width: 0.22 },
      { label: "Due", width: 0.24 },
      { label: "Status", width: 0.16 },
    ],
    report.assignments.map((row) => [row.title, row.class_name, row.due_label, `${statusText[row.status]}${row.lessons_total > 1 ? ` (${row.lessons_done} of ${row.lessons_total})` : ""}`]),
    "No work set by teachers.",
  );

  w.heading("Learning time");
  w.text("Time spent in lessons, in the child's own days.", { color: MUTED, size: 9 });
  w.table(
    [
      { label: report.period.days <= 14 ? "Day" : "Week", width: 0.5 },
      { label: "Time in lessons", width: 0.3, align: "right" },
      { label: "Lessons finished", width: 0.2, align: "right" },
    ],
    learningTimeRows(report),
    "No learning time in this period.",
  );

  const inPeriod = (iso: string) => iso.slice(0, 10) >= report.period.from;
  w.heading("Badges and certificates in this period");
  w.bullets(
    [
      ...report.certificates.filter((row) => inPeriod(row.issued_at)).map((row) => `Certificate: ${row.course} (${row.code}), ${dateText(row.issued_at)}`),
      ...report.badges.filter((row) => inPeriod(row.earned_at)).map((row) => `Badge: ${row.name} (${row.description.replace(/\.$/, "")}), ${dateText(row.earned_at)}`),
    ],
    "None in this period.",
  );

  w.heading("Parental controls");
  w.bullets(describeControls(report.controls), "");

  // Footers, once the page count is known.
  w.pages.forEach((page, index) => {
    const left = w.clean(`Lumina learning report: ${name}`);
    const right = `Page ${index + 1} of ${w.pages.length}`;
    page.drawLine({ start: { x: MARGIN, y: MARGIN + 18 }, end: { x: WIDTH - MARGIN, y: MARGIN + 18 }, thickness: 0.75, color: LINE });
    page.drawText(left, { x: MARGIN, y: MARGIN, size: 8, font: w.regular, color: MUTED });
    page.drawText(right, { x: WIDTH - MARGIN - w.regular.widthOfTextAtSize(right, 8), y: MARGIN, size: 8, font: w.regular, color: MUTED });
  });
  return doc.save();
}

/** The file name: the date and period, never the child's name (it may be shared or synced). */
export function childReportFileName(report: ChildProgress): string {
  return `lumina-learning-report-${report.period.to}-${report.period.days}-days.pdf`;
}
