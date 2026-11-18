/**
 * Quizzes for the seed catalog (scripts/db-seed.ts), in the shapes of src/features/learn/quiz.ts.
 * "Fractions Made Simple" has two: a check-up with one question of every type, one at a time, and a short
 * quiz with every question on one page (the two layouts). Validated here, so a mistake fails loudly.
 */
import { parseQuizSettings, quizQuestionDefinition } from "../src/features/learn/quiz";

export interface QuizSeed {
  courseSlug: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  settings: Record<string, unknown>;
  questions: Array<Record<string, unknown>>;
}

export const QUIZZES: QuizSeed[] = [
  {
    courseSlug: "fractions-made-simple",
    slug: "fractions-check-up",
    title: "Fractions check-up",
    description: "Nine questions about halves, quarters, numerators and denominators. Take your time: you can flag a question and come back to it.",
    position: 1,
    settings: { layout: "one_at_a_time" },
    questions: [
      {
        id: "which-half",
        type: "multiple_choice",
        prompt: "A pizza is cut into 2 equal slices. What fraction is one slice?",
        options: [
          { id: "half", text: "1/2" },
          { id: "quarter", text: "1/4" },
          { id: "two", text: "2/1" },
        ],
        answer: "half",
      },
      {
        id: "equal-to-half",
        type: "multi_select",
        prompt: "Which of these are the same as one half?",
        options: [
          { id: "two-quarters", text: "2/4" },
          { id: "three-sixths", text: "3/6" },
          { id: "one-third", text: "1/3" },
          { id: "four-eighths", text: "4/8" },
        ],
        answers: ["two-quarters", "three-sixths", "four-eighths"],
      },
      { id: "quarter-bigger", type: "true_false", prompt: "True or false: 1/4 is bigger than 1/2.", answer: false },
      {
        id: "bottom-name",
        type: "short_answer",
        prompt: "What do we call the bottom number of a fraction?",
        accepted: ["denominator", "the denominator", "denominater"],
        max_length: 40,
      },
      { id: "half-of-twelve", type: "numeric", prompt: "Sam has 12 stickers and gives away half of them. How many stickers does Sam give away?", answer: 6, unit: "stickers" },
      {
        id: "parts-of-a-fraction",
        type: "fill_blank",
        prompt: "Fill in the blanks.",
        text: "In the fraction 3/4, the number 3 is the [[top]] and the number 4 is the [[bottom]].",
        blanks: [
          { id: "top", accepted: ["numerator"] },
          { id: "bottom", accepted: ["denominator", "denominater"] },
        ],
      },
      {
        id: "match-pictures",
        type: "matching",
        prompt: "Match each sentence with its fraction.",
        left: [
          { id: "half-pizza", text: "Half a pizza" },
          { id: "quarter-cake", text: "One quarter of a cake" },
          { id: "three-quarters", text: "Three quarters of a pie" },
        ],
        right: [
          { id: "f-1-2", text: "1/2" },
          { id: "f-1-3", text: "1/3" },
          { id: "f-1-4", text: "1/4" },
          { id: "f-3-4", text: "3/4" },
        ],
        answer: { "half-pizza": "f-1-2", "quarter-cake": "f-1-4", "three-quarters": "f-3-4" },
      },
      {
        id: "smallest-first",
        type: "ordering",
        prompt: "Put these fractions in order, from the smallest to the biggest.",
        items: [
          { id: "eighth", text: "1/8" },
          { id: "quarter", text: "1/4" },
          { id: "half", text: "1/2" },
          { id: "whole", text: "1 (a whole)" },
        ],
      },
      {
        id: "explain-equal-parts",
        type: "open_response",
        prompt: "Why must the parts be equal when we talk about halves? Explain in your own words.",
        max_length: 600,
        points: 2,
      },
    ],
  },
  {
    courseSlug: "fractions-made-simple",
    slug: "halves-and-quarters",
    title: "Quick quiz: halves and quarters",
    description: "Four quick questions, all on one page.",
    position: 2,
    settings: { layout: "all_on_one_page" },
    questions: [
      {
        id: "quarters-in-whole",
        type: "numeric",
        prompt: "How many quarters make one whole?",
        answer: 4,
      },
      { id: "halves-equal", type: "true_false", prompt: "True or false: two halves make one whole.", answer: true },
      {
        id: "shaded",
        type: "multiple_choice",
        prompt: "A square is split into 4 equal parts and 3 are coloured in. What fraction is coloured?",
        options: [
          { id: "one-quarter", text: "1/4" },
          { id: "three-quarters", text: "3/4" },
          { id: "four-thirds", text: "4/3" },
        ],
        answer: "three-quarters",
      },
      { id: "half-of-eight", type: "numeric", prompt: "What is half of 8?", answer: 4 },
    ],
  },
];

/** The seed quizzes, each question checked against the schema. */
export function quizSeeds(): QuizSeed[] {
  for (const quiz of QUIZZES) {
    parseQuizSettings(quiz.settings);
    for (const question of quiz.questions) {
      const parsed = quizQuestionDefinition.safeParse(question);
      if (!parsed.success) throw new Error(`Seed quiz ${quiz.courseSlug}/${quiz.slug}#${String(question.id)}: ${parsed.error.message}`);
    }
  }
  return QUIZZES;
}
