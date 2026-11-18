import { z } from "zod";

/**
 * Quizzes (FE-ASM-01, FE-ASM-02; the question model of BE-ASM-01, kept small): the question types, the
 * quiz settings, the answers a student gives, and how they are marked.
 *
 * Stored as JSON in `quizzes.questions` / `quizzes.settings`, validated with these schemas whenever they
 * are read (invalid questions are left out, like lesson blocks). The browser only ever receives the
 * *public* shape of a question (`QuizQuestion`, from `toQuizQuestion`): no answers, no accepted spellings.
 * Marking (`gradeAnswer`) runs on the server.
 *
 * Shared by the server and the browser: keep it free of server-only and client-only code. The quiz
 * builder (FE-TCH-05) must produce exactly these shapes.
 */

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Ids are short lower-case slugs.");
const prompt = z.string().trim().min(1).max(1000);
const choiceText = z.string().trim().min(1).max(300);
const choice = z.object({ id, text: choiceText });
const accepted = z.array(z.string().trim().min(1).max(100)).min(1).max(20);

/** Most questions in one quiz. Keeps an autosave of every answer well under the API's request size limit. */
export const MAX_QUESTIONS = 30;
export const SHORT_ANSWER_MAX = 200;
export const OPEN_RESPONSE_MAX = 1000;
export const BLANK_MAX = 100;
export const NUMERIC_MAX = 40;

const base = {
  id,
  prompt,
  /** Points for a fully right answer. */
  points: z.number().int().min(1).max(10).default(1),
};

const uniqueIds = (items: Array<{ id: string }>) => new Set(items.map((item) => item.id)).size === items.length;

export const multipleChoiceQuestion = z
  .object({ ...base, type: z.literal("multiple_choice"), options: z.array(choice).min(2).max(8), answer: id })
  .refine((q) => uniqueIds(q.options), "Option ids must be different.")
  .refine((q) => q.options.some((option) => option.id === q.answer), "The answer must be one of the options.");

export const multiSelectQuestion = z
  .object({ ...base, type: z.literal("multi_select"), options: z.array(choice).min(2).max(10), answers: z.array(id).min(1) })
  .refine((q) => uniqueIds(q.options), "Option ids must be different.")
  .refine((q) => new Set(q.answers).size === q.answers.length && q.answers.every((answer) => q.options.some((option) => option.id === answer)), "Every answer must be one of the options, once.");

export const trueFalseQuestion = z.object({ ...base, type: z.literal("true_false"), answer: z.boolean() });

export const shortAnswerQuestion = z.object({
  ...base,
  type: z.literal("short_answer"),
  /** Every spelling that counts as right. Compared without case (unless `case_sensitive`) and extra spaces. */
  accepted,
  case_sensitive: z.boolean().default(false),
  max_length: z.number().int().min(1).max(SHORT_ANSWER_MAX).default(80),
});

export const numericQuestion = z.object({
  ...base,
  type: z.literal("numeric"),
  answer: z.number(),
  /** How far from `answer` still counts as right (0: exactly). */
  tolerance: z.number().min(0).default(0),
  /** Shown after the box, e.g. "cm". */
  unit: z.string().trim().min(1).max(20).optional(),
});

/** `[[blank-id]]` in fill-in-the-blank text. */
const BLANK_MARKER = /\[\[([a-z0-9][a-z0-9-]{0,39})\]\]/g;

export const fillBlankQuestion = z
  .object({
    ...base,
    type: z.literal("fill_blank"),
    /** The sentence, with a `[[blank-id]]` marker for each blank: "A half is [[top]] out of [[bottom]] equal parts." */
    text: z.string().trim().min(1).max(2000),
    blanks: z.array(z.object({ id, accepted, case_sensitive: z.boolean().default(false) })).min(1).max(10),
  })
  .refine((q) => {
    const markers = [...q.text.matchAll(BLANK_MARKER)].map((match) => match[1]!);
    const ids = q.blanks.map((blank) => blank.id);
    return uniqueIds(q.blanks) && new Set(markers).size === markers.length && markers.length === ids.length && ids.every((blankId) => markers.includes(blankId));
  }, "Every blank needs exactly one [[id]] marker in the text, and every marker a blank.");

export const matchingQuestion = z
  .object({
    ...base,
    type: z.literal("matching"),
    /** The items to match, in the order shown. */
    left: z.array(choice).min(2).max(8),
    /** What they match with, in the order shown. May hold extra choices that match nothing. */
    right: z.array(choice).min(2).max(10),
    /** Left id → right id. */
    answer: z.record(z.string(), id),
  })
  .refine((q) => uniqueIds(q.left) && uniqueIds(q.right), "Ids must be different.")
  .refine(
    (q) => q.left.every((item) => q.right.some((option) => option.id === q.answer[item.id])) && Object.keys(q.answer).length === q.left.length,
    "Every item on the left needs one match on the right.",
  );

export const orderingQuestion = z
  .object({
    ...base,
    type: z.literal("ordering"),
    /** In the right order. Students see them shuffled (`toQuizQuestion`). */
    items: z.array(choice).min(2).max(8),
  })
  .refine((q) => uniqueIds(q.items), "Item ids must be different.");

/** A written answer in the student's own words: not marked automatically (teachers' marking: FE-TCH-09). */
export const openResponseQuestion = z.object({
  ...base,
  type: z.literal("open_response"),
  max_length: z.number().int().min(1).max(OPEN_RESPONSE_MAX).default(OPEN_RESPONSE_MAX),
});

export const quizQuestionDefinition = z.union([
  multipleChoiceQuestion,
  multiSelectQuestion,
  trueFalseQuestion,
  shortAnswerQuestion,
  numericQuestion,
  fillBlankQuestion,
  matchingQuestion,
  orderingQuestion,
  openResponseQuestion,
]);

export type QuestionDefinition = z.output<typeof quizQuestionDefinition>;
export type QuestionType = QuestionDefinition["type"];
type Definition<T extends QuestionType> = Extract<QuestionDefinition, { type: T }>;

export const QUESTION_TYPES: readonly QuestionType[] = [
  "multiple_choice",
  "multi_select",
  "true_false",
  "short_answer",
  "numeric",
  "fill_blank",
  "matching",
  "ordering",
  "open_response",
];

/**
 * How the quiz is presented. `one_at_a_time`: a question per screen with Previous / Next (calmer, the
 * default for younger students). `all_on_one_page`: every question on one scrolling page.
 */
export const QUIZ_LAYOUTS = ["one_at_a_time", "all_on_one_page"] as const;
export type QuizLayout = (typeof QUIZ_LAYOUTS)[number];

export const quizSettings = z.object({
  layout: z.enum(QUIZ_LAYOUTS).default("one_at_a_time"),
});
export type QuizSettings = z.output<typeof quizSettings>;

/** The stored settings; anything invalid falls back to the defaults. */
export function parseQuizSettings(value: unknown): QuizSettings {
  const parsed = quizSettings.safeParse(value ?? {});
  return parsed.success ? parsed.data : quizSettings.parse({});
}

/** The valid questions of a quiz, in order. Invalid ones (and repeated ids) are left out and counted. */
export function parseQuestions(content: unknown): { questions: QuestionDefinition[]; dropped: number } {
  if (!Array.isArray(content)) return { questions: [], dropped: 0 };
  const questions: QuestionDefinition[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const raw of content.slice(0, MAX_QUESTIONS)) {
    const parsed = quizQuestionDefinition.safeParse(raw);
    if (parsed.success && !seen.has(parsed.data.id)) {
      seen.add(parsed.data.id);
      questions.push(parsed.data);
    } else {
      dropped += 1;
    }
  }
  return { questions, dropped: dropped + Math.max(0, content.length - MAX_QUESTIONS) };
}

// --- What the browser sees -------------------------------------------------------------------------

export type FillBlankSegment = { kind: "text"; text: string } | { kind: "blank"; id: string };

interface PublicBase {
  id: string;
  prompt: string;
  points: number;
}

/** A question as the student sees it: never the answer. */
export type QuizQuestion =
  | (PublicBase & { type: "multiple_choice"; options: Choice[] })
  | (PublicBase & { type: "multi_select"; options: Choice[] })
  | (PublicBase & { type: "true_false" })
  | (PublicBase & { type: "short_answer"; max_length: number })
  | (PublicBase & { type: "numeric"; unit: string | null })
  | (PublicBase & { type: "fill_blank"; segments: FillBlankSegment[] })
  | (PublicBase & { type: "matching"; left: Choice[]; right: Choice[] })
  | (PublicBase & { type: "ordering"; items: Choice[] })
  | (PublicBase & { type: "open_response"; max_length: number });

export interface Choice {
  id: string;
  text: string;
}

/** Splits fill-in-the-blank text into text and blanks, in order. */
export function fillBlankSegments(text: string): FillBlankSegment[] {
  const segments: FillBlankSegment[] = [];
  let at = 0;
  for (const match of text.matchAll(BLANK_MARKER)) {
    if (match.index > at) segments.push({ kind: "text", text: text.slice(at, match.index) });
    segments.push({ kind: "blank", id: match[1]! });
    at = match.index + match[0].length;
  }
  if (at < text.length) segments.push({ kind: "text", text: text.slice(at) });
  return segments;
}

/** A small seeded generator (mulberry32), so a shuffle is the same every time for the same question. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The ordering items as shown: shuffled (the same way for every student, so a page reload doesn't move
 * them), and never already in the right order.
 */
export function shuffledItems<T extends { id: string }>(items: readonly T[], seed: string): T[] {
  const random = seeded(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  if (result.length > 1 && result.every((item, index) => item.id === items[index]!.id)) result.push(result.shift()!);
  return result;
}

export function toQuizQuestion(question: QuestionDefinition): QuizQuestion {
  const common = { id: question.id, prompt: question.prompt, points: question.points };
  switch (question.type) {
    case "multiple_choice":
    case "multi_select":
      return { ...common, type: question.type, options: question.options };
    case "true_false":
      return { ...common, type: "true_false" };
    case "short_answer":
      return { ...common, type: "short_answer", max_length: question.max_length };
    case "numeric":
      return { ...common, type: "numeric", unit: question.unit ?? null };
    case "fill_blank":
      return { ...common, type: "fill_blank", segments: fillBlankSegments(question.text) };
    case "matching":
      return { ...common, type: "matching", left: question.left, right: question.right };
    case "ordering":
      return { ...common, type: "ordering", items: shuffledItems(question.items, question.id) };
    case "open_response":
      return { ...common, type: "open_response", max_length: question.max_length };
  }
}

// --- Answers ----------------------------------------------------------------------------------------

/**
 * One answer, by question type:
 * multiple_choice: option id · multi_select: option ids · true_false: boolean · short_answer, numeric,
 * open_response: the text typed · fill_blank: blank id → text · matching: left id → right id ·
 * ordering: item ids in the student's order.
 */
export type QuizAnswer = string | string[] | boolean | Record<string, string>;
export type QuizAnswers = Record<string, QuizAnswer>;

/** The schema one answer must match, for this question (the server checks every answer it stores). */
export function answerSchemaFor(question: QuestionDefinition | QuizQuestion): z.ZodType<QuizAnswer> {
  switch (question.type) {
    case "multiple_choice": {
      const ids = question.options.map((option) => option.id);
      return z.string().refine((value) => ids.includes(value), "Choose one of the answers.");
    }
    case "multi_select": {
      const ids = question.options.map((option) => option.id);
      return z
        .array(z.string())
        .max(ids.length)
        .refine((values) => new Set(values).size === values.length && values.every((value) => ids.includes(value)), "Choose from the answers given.");
    }
    case "true_false":
      return z.boolean();
    case "short_answer":
    case "open_response":
      return z.string().max(question.max_length, `Keep it under ${question.max_length} characters.`);
    case "numeric":
      return z.string().max(NUMERIC_MAX, "That number is too long.");
    case "fill_blank": {
      const ids = "blanks" in question ? question.blanks.map((blank) => blank.id) : question.segments.flatMap((segment) => (segment.kind === "blank" ? [segment.id] : []));
      return z
        .record(z.string(), z.string().max(BLANK_MAX, `Keep each blank under ${BLANK_MAX} characters.`))
        .refine((value) => Object.keys(value).every((key) => ids.includes(key)), "Fill in the blanks of this question.");
    }
    case "matching": {
      const left = question.left.map((item) => item.id);
      const right = question.right.map((item) => item.id);
      return z
        .record(z.string(), z.string())
        .refine((value) => Object.entries(value).every(([key, match]) => left.includes(key) && right.includes(match)), "Match the items of this question.");
    }
    case "ordering": {
      const ids = question.items.map((item) => item.id);
      return z
        .array(z.string())
        .refine((values) => values.length === ids.length && new Set(values).size === ids.length && values.every((value) => ids.includes(value)), "Put every item in order once.");
    }
  }
}

/**
 * Whether the student has given an answer (for the navigator, the "answered" count and the submit check).
 * A question with several parts (blanks, matches) counts once every part is filled in.
 */
export function isAnswered(question: QuizQuestion | QuestionDefinition, answer: QuizAnswer | undefined): boolean {
  if (answer === undefined || answer === null) return false;
  switch (question.type) {
    case "multiple_choice":
      return typeof answer === "string" && answer.length > 0;
    case "multi_select":
      return Array.isArray(answer) && answer.length > 0;
    case "true_false":
      return typeof answer === "boolean";
    case "short_answer":
    case "numeric":
    case "open_response":
      return typeof answer === "string" && answer.trim().length > 0;
    case "fill_blank": {
      if (typeof answer !== "object" || Array.isArray(answer)) return false;
      const ids = "blanks" in question ? question.blanks.map((blank) => blank.id) : question.segments.flatMap((segment) => (segment.kind === "blank" ? [segment.id] : []));
      return ids.every((blankId) => (answer[blankId] ?? "").trim().length > 0);
    }
    case "matching":
      return typeof answer === "object" && !Array.isArray(answer) && question.left.every((item) => Boolean(answer[item.id]));
    case "ordering":
      return Array.isArray(answer) && answer.length === question.items.length;
  }
}

// --- Marking ----------------------------------------------------------------------------------------

/** Text compared the forgiving way: same Unicode form, no extra spaces, and no case unless it matters. */
export function normalizeText(value: string, caseSensitive = false): string {
  const cleaned = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return caseSensitive ? cleaned : cleaned.toLocaleLowerCase("en");
}

/**
 * A number as a student types it: "12", "-2.5", "2,5" (decimal comma), "3/4", "1 000". Null when it
 * isn't one.
 */
export function parseNumber(value: string): number | null {
  const cleaned = value.normalize("NFKC").trim().replace(/[\s\u00a0]/g, "").replace(/^\u2212/, "-");
  if (!cleaned) return null;
  const fraction = /^(-?\d+)\/(\d+)$/.exec(cleaned);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  const decimal = cleaned.includes(",") && !cleaned.includes(".") && /^-?\d+,\d+$/.test(cleaned) ? cleaned.replace(",", ".") : cleaned;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(decimal)) return null;
  const number = Number(decimal);
  return Number.isFinite(number) ? number : null;
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value) => b.includes(value));

/**
 * Marks one answer: right (all its points), wrong or unanswered (none), or null for open responses, which
 * a person has to read. All or nothing per question: one missed blank means the question isn't right yet.
 */
export function gradeAnswer(question: QuestionDefinition, answer: QuizAnswer | undefined): { correct: boolean | null; points: number } {
  if (question.type === "open_response") return { correct: null, points: 0 };
  const correct = isAnswered(question, answer) && isRight(question, answer!);
  return { correct, points: correct ? question.points : 0 };
}

function isRight(question: Exclude<QuestionDefinition, Definition<"open_response">>, answer: QuizAnswer): boolean {
  switch (question.type) {
    case "multiple_choice":
      return answer === question.answer;
    case "multi_select":
      return Array.isArray(answer) && sameSet(answer, question.answers);
    case "true_false":
      return answer === question.answer;
    case "short_answer":
      return typeof answer === "string" && question.accepted.some((right) => normalizeText(right, question.case_sensitive) === normalizeText(answer, question.case_sensitive));
    case "numeric": {
      const value = typeof answer === "string" ? parseNumber(answer) : null;
      return value !== null && Math.abs(value - question.answer) <= question.tolerance + 1e-9;
    }
    case "fill_blank":
      return (
        typeof answer === "object" &&
        !Array.isArray(answer) &&
        question.blanks.every((blank) => blank.accepted.some((right) => normalizeText(right, blank.case_sensitive) === normalizeText(answer[blank.id] ?? "", blank.case_sensitive)))
      );
    case "matching":
      return typeof answer === "object" && !Array.isArray(answer) && question.left.every((item) => answer[item.id] === question.answer[item.id]);
    case "ordering":
      return Array.isArray(answer) && answer.length === question.items.length && question.items.every((item, index) => answer[index] === item.id);
  }
}

export interface QuizGrade {
  /** Points for right answers. */
  score: number;
  /** Points of the questions marked automatically. */
  max_score: number;
  /** Written answers not marked automatically, and their points. */
  pending_review: number;
  pending_points: number;
  answered: number;
  /**
   * Per question: answered or not, right, wrong or null (a written answer, not marked automatically), points earned and possible.
   * Stored with the attempt, so a finished attempt reads the same after the quiz is edited (and for the
   * results screen, FE-ASM-04).
   */
  results: Record<string, QuestionResult>;
}

export interface QuestionResult {
  answered: boolean;
  correct: boolean | null;
  points: number;
  max: number;
}

export function gradeQuiz(questions: readonly QuestionDefinition[], answers: QuizAnswers): QuizGrade {
  const grade: QuizGrade = { score: 0, max_score: 0, pending_review: 0, pending_points: 0, answered: 0, results: {} };
  for (const question of questions) {
    const answer = answers[question.id];
    const answered = isAnswered(question, answer);
    const result = gradeAnswer(question, answer);
    grade.results[question.id] = { answered, correct: result.correct, points: result.points, max: question.points };
    if (answered) grade.answered += 1;
    if (result.correct === null) {
      grade.pending_review += 1;
      grade.pending_points += question.points;
    } else {
      grade.max_score += question.points;
      grade.score += result.points;
    }
  }
  return grade;
}

/** The question type in a few words, for screen readers and hints. */
export const questionTypeHint: Record<QuestionType, string> = {
  multiple_choice: "Choose one answer.",
  multi_select: "Choose all the answers that are right.",
  true_false: "Choose true or false.",
  short_answer: "Type a short answer.",
  numeric: "Type a number, like 12, 2.5 or 3/4.",
  fill_blank: "Fill in every blank.",
  matching: "Match each item with one answer.",
  ordering: "Put the items in the right order.",
  open_response: "Write your answer in your own words.",
};
