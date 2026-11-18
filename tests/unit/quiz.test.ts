import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerSchemaFor,
  fillBlankSegments,
  gradeAnswer,
  gradeQuiz,
  isAnswered,
  normalizeText,
  parseNumber,
  parseQuestions,
  parseQuizSettings,
  quizQuestionDefinition,
  shuffledItems,
  toQuizQuestion,
  type QuestionDefinition,
} from "@/features/learn/quiz";
import { QuizAutosave, type AutosaveState } from "@/features/learn/sync/quiz-autosave";
import { QUIZZES } from "../../scripts/seed-quizzes";
import { AUTO_POINTS, QUESTIONS, RIGHT_ANSWERS } from "../support/quiz";

const questions = parseQuestions(QUESTIONS).questions;
const byId = (id: string) => questions.find((question) => question.id === id)!;

describe("quiz questions", () => {
  it("reads every question type, with defaults, and leaves out invalid ones", () => {
    expect(questions.map((question) => question.type)).toEqual([
      "multiple_choice",
      "multi_select",
      "true_false",
      "short_answer",
      "numeric",
      "fill_blank",
      "matching",
      "ordering",
      "open_response",
    ]);
    expect(byId("mc").points).toBe(1);
    expect(byId("short")).toMatchObject({ case_sensitive: false, max_length: 80 });
    expect(byId("num")).toMatchObject({ tolerance: 0, points: 2 });

    const broken = [
      { id: "mc-bad-answer", type: "multiple_choice", prompt: "?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: "c" },
      { id: "ms-twice", type: "multi_select", prompt: "?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answers: ["a", "a"] },
      { id: "blank-missing", type: "fill_blank", prompt: "?", text: "A [[one]] and [[two]]", blanks: [{ id: "one", accepted: ["x"] }] },
      { id: "blank-extra", type: "fill_blank", prompt: "?", text: "A [[one]]", blanks: [{ id: "one", accepted: ["x"] }, { id: "two", accepted: ["y"] }] },
      { id: "match-gap", type: "matching", prompt: "?", left: [{ id: "l1", text: "1" }, { id: "l2", text: "2" }], right: [{ id: "r1", text: "A" }, { id: "r2", text: "B" }], answer: { l1: "r1" } },
      { id: "order-dupe", type: "ordering", prompt: "?", items: [{ id: "a", text: "A" }, { id: "a", text: "B" }] },
      { id: "Bad Id", type: "true_false", prompt: "?", answer: true },
      { id: "unknown", type: "essay", prompt: "?" },
      "not an object",
    ];
    for (const question of broken) expect(quizQuestionDefinition.safeParse(question).success, JSON.stringify(question)).toBe(false);
    const parsed = parseQuestions([QUESTIONS[0], ...broken, QUESTIONS[0]]);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.dropped).toBe(broken.length + 1); // the repeated id too
    expect(parseQuestions("nope")).toEqual({ questions: [], dropped: 0 });
  });

  it("defaults the layout to one question at a time", () => {
    expect(parseQuizSettings(undefined)).toEqual({ layout: "one_at_a_time" });
    expect(parseQuizSettings({ layout: "all_on_one_page" })).toEqual({ layout: "all_on_one_page" });
    expect(parseQuizSettings({ layout: "sideways" })).toEqual({ layout: "one_at_a_time" });
  });

  it("never puts an answer in what the browser sees", () => {
    for (const question of questions) {
      const shown = JSON.stringify(toQuizQuestion(question));
      expect(shown).not.toMatch(/"(answer|answers|accepted|tolerance|case_sensitive|blanks)"/);
    }
    expect(toQuizQuestion(byId("blank"))).toMatchObject({ type: "fill_blank", segments: fillBlankSegments((byId("blank") as { text: string }).text) });
    expect(toQuizQuestion(byId("num"))).toMatchObject({ unit: "apples" });
  });

  it("splits fill-in-the-blank text into text and blanks", () => {
    expect(fillBlankSegments("[[a]] plus [[b]]")).toEqual([
      { kind: "blank", id: "a" },
      { kind: "text", text: " plus " },
      { kind: "blank", id: "b" },
    ]);
    expect(fillBlankSegments("No blanks [[Not An Id]]")).toEqual([{ kind: "text", text: "No blanks [[Not An Id]]" }]);
  });

  it("shuffles ordering items the same way every time, never into the right order", () => {
    const items = ["a", "b", "c", "d"].map((id) => ({ id, text: id }));
    for (const seed of ["q1", "q2", "order", "x", "y", "z"]) {
      const once = shuffledItems(items, seed);
      expect(shuffledItems(items, seed)).toEqual(once);
      expect(once.map((item) => item.id)).not.toEqual(["a", "b", "c", "d"]);
      expect(once.map((item) => item.id).sort()).toEqual(["a", "b", "c", "d"]);
    }
    expect(shuffledItems(items.slice(0, 2), "any").map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("marking", () => {
  it("marks a perfect quiz, leaving written answers unmarked", () => {
    const grade = gradeQuiz(questions, RIGHT_ANSWERS);
    expect(grade).toMatchObject({ score: AUTO_POINTS, max_score: AUTO_POINTS, pending_review: 1, pending_points: 3, answered: 9 });
    expect(grade.results.num).toEqual({ answered: true, correct: true, points: 2, max: 2 });
    expect(grade.results.open).toEqual({ answered: true, correct: null, points: 0, max: 3 });
  });

  it("marks nothing answered as nothing right", () => {
    expect(gradeQuiz(questions, {})).toMatchObject({ score: 0, max_score: AUTO_POINTS, answered: 0 });
  });

  it("is all or nothing per question", () => {
    expect(gradeAnswer(byId("ms"), ["two-quarters"]).correct).toBe(false);
    expect(gradeAnswer(byId("ms"), ["two-quarters", "three-sixths", "one-third"]).correct).toBe(false);
    expect(gradeAnswer(byId("blank"), { top: "numerator", bottom: "numerator" }).correct).toBe(false);
    expect(gradeAnswer(byId("match"), { "half-pizza": "f-half", "quarter-cake": "f-third" }).correct).toBe(false);
    expect(gradeAnswer(byId("order"), ["quarter", "eighth", "half"]).correct).toBe(false);
    expect(gradeAnswer(byId("tf"), true)).toEqual({ correct: false, points: 0 });
    expect(gradeAnswer(byId("mc"), "b").correct).toBe(false);
  });

  it("forgives case and spacing in typed answers, unless the question says case matters", () => {
    expect(normalizeText("  The   Denominator ")).toBe("the denominator");
    expect(normalizeText("ＡＢＣ")).toBe("abc"); // full-width letters (NFKC)
    expect(gradeAnswer(byId("short"), "DENOMINATOR").correct).toBe(true);
    expect(gradeAnswer(byId("short"), "numerator").correct).toBe(false);
    const strict = quizQuestionDefinition.parse({ id: "caps", type: "short_answer", prompt: "Capital of France?", accepted: ["Paris"], case_sensitive: true });
    expect(gradeAnswer(strict, "Paris").correct).toBe(true);
    expect(gradeAnswer(strict, "paris").correct).toBe(false);
  });

  it("reads numbers the way students type them", () => {
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber(" -2.5 ")).toBe(-2.5);
    expect(parseNumber("2,5")).toBe(2.5);
    expect(parseNumber("3/4")).toBe(0.75);
    expect(parseNumber("1 000")).toBe(1000);
    expect(parseNumber(".5")).toBe(0.5);
    expect(parseNumber("−3")).toBe(-3); // the minus sign, not a hyphen
    for (const bad of ["", "abc", "1/0", "1,000.5", "1e5", "2..5", "--1", "Infinity"]) expect(parseNumber(bad), bad).toBeNull();
    expect(gradeAnswer(byId("num"), "10/2").correct).toBe(true);
    expect(gradeAnswer(byId("num"), "five").correct).toBe(false);
    const rough = quizQuestionDefinition.parse({ id: "pi", type: "numeric", prompt: "Pi to 2 places?", answer: 3.14, tolerance: 0.01 });
    expect(gradeAnswer(rough, "3.15").correct).toBe(true);
    expect(gradeAnswer(rough, "3.16").correct).toBe(false);
  });

  it("knows when a question is answered, including every part of it", () => {
    expect(isAnswered(byId("mc"), undefined)).toBe(false);
    expect(isAnswered(byId("tf"), false)).toBe(true);
    expect(isAnswered(byId("ms"), [])).toBe(false);
    expect(isAnswered(byId("short"), "   ")).toBe(false);
    expect(isAnswered(byId("blank"), { top: "x" })).toBe(false);
    expect(isAnswered(byId("blank"), { top: "x", bottom: "y" })).toBe(true);
    expect(isAnswered(byId("match"), { "half-pizza": "f-half" })).toBe(false);
    expect(isAnswered(byId("order"), ["eighth", "quarter", "half"])).toBe(true);
    // The public shape works the same (the browser's navigator and Finish dialog use it).
    expect(isAnswered(toQuizQuestion(byId("blank")), { top: "x", bottom: "y" })).toBe(true);
  });

  it("checks the shape of each answer before storing it", () => {
    const check = (question: QuestionDefinition, answer: unknown) => answerSchemaFor(question).safeParse(answer).success;
    expect(check(byId("mc"), "a")).toBe(true);
    expect(check(byId("mc"), "z")).toBe(false);
    expect(check(byId("ms"), ["two-quarters", "two-quarters"])).toBe(false);
    expect(check(byId("tf"), "true")).toBe(false);
    expect(check(byId("short"), "x".repeat(80))).toBe(true);
    expect(check(byId("short"), "x".repeat(81))).toBe(false);
    expect(check(byId("num"), 5)).toBe(false);
    expect(check(byId("blank"), { top: "x", other: "y" })).toBe(false);
    expect(check(byId("match"), { "half-pizza": "f-third" })).toBe(true);
    expect(check(byId("match"), { nope: "f-third" })).toBe(false);
    expect(check(byId("order"), ["eighth", "quarter", "quarter"])).toBe(false);
    expect(check(byId("open"), "x".repeat(501))).toBe(false);
  });

  it("has valid seed quizzes covering every question type and both layouts", () => {
    const types = new Set(QUIZZES.flatMap((quiz) => quiz.questions.map((question) => question.type)));
    expect(types.size).toBe(9);
    expect(new Set(QUIZZES.map((quiz) => parseQuizSettings(quiz.settings).layout))).toEqual(new Set(["one_at_a_time", "all_on_one_page"]));
    for (const quiz of QUIZZES) expect(parseQuestions(quiz.questions).dropped, quiz.slug).toBe(0);
  });
});

describe("quiz autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  class Refused extends Error {}
  function setup(delayMs = 800) {
    const sent: Array<{ state: number; keepalive: boolean }> = [];
    const states: AutosaveState["status"][] = [];
    const pending: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];
    const autosave = new QuizAutosave<number>({
      delayMs,
      retryMs: [1000, 5000],
      send: (state, { keepalive }) => {
        sent.push({ state, keepalive });
        return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
      },
      isRetryable: (error) => !(error instanceof Refused),
      onChange: (state) => states.push(state.status),
    });
    return { autosave, sent, states, pending };
  }

  it("waits for a pause in typing, then saves the newest state once", async () => {
    const { autosave, sent, states, pending } = setup();
    autosave.update(1);
    await vi.advanceTimersByTimeAsync(500);
    autosave.update(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(300);
    expect(sent).toEqual([{ state: 2, keepalive: false }]);
    pending[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(autosave.state.status).toBe("saved");
    expect(states).toEqual(["pending", "pending", "saving", "saved"]);
  });

  it("sends one save at a time, then what changed while it was on its way", async () => {
    const { autosave, sent, pending } = setup(100);
    autosave.update(1);
    await vi.advanceTimersByTimeAsync(100);
    autosave.update(2);
    autosave.update(3);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent.map((entry) => entry.state)).toEqual([1]); // still waiting for the first
    pending[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.map((entry) => entry.state)).toEqual([1, 3]);
    expect(autosave.hasUnsaved).toBe(true);
    pending[1]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(autosave.hasUnsaved).toBe(false);
  });

  it("retries after a connection problem, with the newest state, then gives up on a refusal", async () => {
    const { autosave, sent, pending } = setup(100);
    autosave.update(1);
    await vi.advanceTimersByTimeAsync(100);
    pending[0]!.reject(new TypeError("Failed to fetch"));
    await vi.advanceTimersByTimeAsync(0);
    expect(autosave.state.status).toBe("retrying");
    autosave.update(2); // the student keeps answering while offline
    await vi.advanceTimersByTimeAsync(100);
    expect(sent.map((entry) => entry.state)).toEqual([1, 2]);
    pending[1]!.reject(new Refused("already finished"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(autosave.state).toEqual({ status: "failed", error: expect.any(Refused) });
    expect(sent).toHaveLength(2);
    autosave.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.map((entry) => entry.state)).toEqual([1, 2, 2]);
  });

  it("backs off between retries", async () => {
    const { autosave, sent, pending } = setup(100);
    autosave.update(1);
    await vi.advanceTimersByTimeAsync(100);
    pending[0]!.reject(new TypeError("offline"));
    await vi.advanceTimersByTimeAsync(999);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(2);
    pending[1]!.reject(new TypeError("offline"));
    await vi.advanceTimersByTimeAsync(4999);
    expect(sent).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(3);
  });

  it("sends what is waiting with keepalive when the page goes away, after any save on its way", async () => {
    const { autosave, sent, pending } = setup(100);
    autosave.update(1);
    autosave.flushOnHide();
    expect(sent).toEqual([{ state: 1, keepalive: true }]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent).toHaveLength(1); // not sent twice

    const second = setup(100);
    second.autosave.update(1);
    await vi.advanceTimersByTimeAsync(100);
    second.autosave.update(2);
    second.autosave.flushOnHide();
    expect(second.sent.map((entry) => entry.state)).toEqual([1]); // 2 waits: it must not land before 1
    second.pending[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(second.sent).toEqual([
      { state: 1, keepalive: false },
      { state: 2, keepalive: true },
    ]);
    expect(pending).toHaveLength(1);
  });

  it("saves nothing while paused (being submitted) or after it is disposed", async () => {
    const { autosave, sent } = setup(100);
    autosave.update(1);
    autosave.pause();
    await vi.advanceTimersByTimeAsync(1000);
    autosave.flushOnHide();
    expect(sent).toEqual([]);
    autosave.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);
    autosave.dispose();
    autosave.update(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent).toHaveLength(1);
  });
});
