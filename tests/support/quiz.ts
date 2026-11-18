import type { QuizAnswers } from "@/features/learn/quiz";

/** One question of every type, as stored (with answers). Shared by the unit, component and API tests. */
export const QUESTIONS = [
  {
    id: "mc",
    type: "multiple_choice",
    prompt: "Which fraction is one half?",
    options: [
      { id: "a", text: "1/2" },
      { id: "b", text: "1/4" },
      { id: "c", text: "2/1" },
    ],
    answer: "a",
  },
  {
    id: "ms",
    type: "multi_select",
    prompt: "Which fractions equal one half?",
    options: [
      { id: "two-quarters", text: "2/4" },
      { id: "three-sixths", text: "3/6" },
      { id: "one-third", text: "1/3" },
    ],
    answers: ["two-quarters", "three-sixths"],
  },
  { id: "tf", type: "true_false", prompt: "1/4 is bigger than 1/2.", answer: false },
  { id: "short", type: "short_answer", prompt: "What is the bottom number of a fraction called?", accepted: ["denominator", "the denominator"] },
  { id: "num", type: "numeric", prompt: "What is half of 10?", answer: 5, unit: "apples", points: 2 },
  {
    id: "blank",
    type: "fill_blank",
    prompt: "Fill in the blanks.",
    text: "The top number is the [[top]] and the bottom number is the [[bottom]].",
    blanks: [
      { id: "top", accepted: ["numerator"] },
      { id: "bottom", accepted: ["denominator"] },
    ],
  },
  {
    id: "match",
    type: "matching",
    prompt: "Match each picture to its fraction.",
    left: [
      { id: "half-pizza", text: "Half a pizza" },
      { id: "quarter-cake", text: "A quarter of a cake" },
    ],
    right: [
      { id: "f-half", text: "1/2" },
      { id: "f-quarter", text: "1/4" },
      { id: "f-third", text: "1/3" },
    ],
    answer: { "half-pizza": "f-half", "quarter-cake": "f-quarter" },
  },
  {
    id: "order",
    type: "ordering",
    prompt: "Put these from smallest to largest.",
    items: [
      { id: "eighth", text: "1/8" },
      { id: "quarter", text: "1/4" },
      { id: "half", text: "1/2" },
    ],
  },
  { id: "open", type: "open_response", prompt: "Explain why 2/4 is the same as 1/2.", max_length: 500, points: 3 },
] as const;

/** Every auto-marked question answered right (the open response is for the teacher). */
export const RIGHT_ANSWERS: QuizAnswers = {
  mc: "a",
  ms: ["three-sixths", "two-quarters"],
  tf: false,
  short: "  The   Denominator ",
  num: "5",
  blank: { top: "Numerator", bottom: "denominator" },
  match: { "half-pizza": "f-half", "quarter-cake": "f-quarter" },
  order: ["eighth", "quarter", "half"],
  open: "Because two quarters fill the same space as one half.",
};

/** Points of the auto-marked questions: 1 each, except the numeric one (2). */
export const AUTO_POINTS = 9;
