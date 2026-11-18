import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { GET as courseQuizzes } from "@/app/api/learn/courses/[courseId]/quizzes/route";
import { DELETE as unenroll } from "@/app/api/learn/enrollments/[courseId]/route";
import { POST as enroll } from "@/app/api/learn/enrollments/route";
import { PUT as saveAttempt } from "@/app/api/learn/quiz-attempts/[attemptId]/route";
import { POST as submitAttempt } from "@/app/api/learn/quiz-attempts/[attemptId]/submit/route";
import { POST as startAttempt } from "@/app/api/learn/quizzes/[quizId]/attempts/route";
import { GET as quizView } from "@/app/api/learn/quizzes/[quizId]/route";
import { GET as summary } from "@/app/api/learn/summary/route";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import { Browser } from "../support/browser";
import { createCatalog, createUser, PASSWORD } from "../support/factories";
import { AUTO_POINTS, QUESTIONS, RIGHT_ANSWERS } from "../support/quiz";

async function student(username = "kid1") {
  const user = await createUser({ role: "student", username, displayName: "Maya", gradeLevel: 4, timezone: "UTC" });
  const browser = new Browser();
  expect((await browser.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username, password: PASSWORD } })).status).toBe(200);
  return { user, browser };
}

/** The test catalog's Fractions course with a quiz of every question type (and one broken question). */
async function fractionsQuiz({ layout = "one_at_a_time" }: { layout?: string } = {}) {
  await createCatalog();
  const course = await getDb().course.findUniqueOrThrow({ where: { slug: "fractions" } });
  const quiz = await getDb().quiz.create({
    data: {
      courseId: course.id,
      slug: "check-up",
      title: "Fractions check-up",
      description: "Nine questions.",
      settings: { layout },
      questions: [...QUESTIONS, { id: "broken", type: "multiple_choice", prompt: "No options" }] as unknown as Prisma.InputJsonArray,
    },
  });
  return { course, quiz };
}

const view = (browser: Browser, quizId: string) => browser.call(quizView, { path: "/api/learn/quizzes/x", params: { quizId } });
const start = (browser: Browser, quizId: string) => browser.call(startAttempt, { method: "POST", path: "/api/learn/quizzes/x/attempts", params: { quizId } });
const save = (browser: Browser, attemptId: string, body: unknown) => browser.call(saveAttempt, { method: "PUT", path: "/api/learn/quiz-attempts/x", params: { attemptId }, body });
const submit = (browser: Browser, attemptId: string, body: unknown = {}) =>
  browser.call(submitAttempt, { method: "POST", path: "/api/learn/quiz-attempts/x/submit", params: { attemptId }, body });
const enrollIn = (browser: Browser, courseId: string) => browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: courseId } });

describe("quizzes API", () => {
  it("shows a quiz without its answers, and only its questions once the course is started", async () => {
    const { course, quiz } = await fractionsQuiz({ layout: "all_on_one_page" });
    const { browser } = await student();

    const before = await view(browser, quiz.id);
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({
      course: { slug: "fractions", title: "Fractions Made Simple" },
      quiz: { slug: "check-up", title: "Fractions check-up", layout: "all_on_one_page", question_count: 9, points_total: 12 },
      enrolled: false,
      questions: [],
      attempt: null,
      last_result: null,
    });
    expect((await start(browser, quiz.id)).body.error.code).toBe("not_enrolled");

    await enrollIn(browser, course.id);
    const after = await view(browser, quiz.id);
    expect(after.body.enrolled).toBe(true);
    // The broken question is left out; the others keep their order.
    expect(after.body.questions.map((question: { id: string }) => question.id)).toEqual(QUESTIONS.map((question) => question.id));
    const raw = JSON.stringify(after.body.questions);
    for (const secret of ['"answer"', '"answers"', '"accepted"', "denominator", "tolerance"]) expect(raw).not.toContain(secret);
    const byId = Object.fromEntries(after.body.questions.map((question: { id: string }) => [question.id, question]));
    expect(byId.num).toMatchObject({ type: "numeric", unit: "apples", points: 2 });
    expect(byId.blank.segments).toEqual([
      { kind: "text", text: "The top number is the " },
      { kind: "blank", id: "top" },
      { kind: "text", text: " and the bottom number is the " },
      { kind: "blank", id: "bottom" },
      { kind: "text", text: "." },
    ]);
    // Ordering items arrive shuffled, never already in order.
    expect(byId.order.items.map((item: { id: string }) => item.id)).not.toEqual(["eighth", "quarter", "half"]);
    expect(byId.order.items.map((item: { id: string }) => item.id).sort()).toEqual(["eighth", "half", "quarter"]);
  });

  it("starts one attempt, carries on with it, saves answers and flags, then marks it on submit", async () => {
    const { course, quiz } = await fractionsQuiz();
    const { browser } = await student();
    await enrollIn(browser, course.id);

    const first = await start(browser, quiz.id);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ status: "in_progress", answers: {}, flagged: [] });
    // Starting again (a double click, another tab) returns the same attempt.
    const again = await start(browser, quiz.id);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    const together = await Promise.all([start(browser, quiz.id), start(browser, quiz.id)]);
    expect(new Set(together.map((response) => response.body.id))).toEqual(new Set([first.body.id]));

    const saved = await save(browser, first.body.id, { answers: { mc: "b", tf: true, gone: "x" }, flagged: ["tf", "tf", "gone"] });
    expect(saved.status).toBe(200);
    expect(saved.body.saved_at).toEqual(expect.any(String));
    const resumed = await view(browser, quiz.id);
    // Answers and flags for questions not in the quiz are dropped; a flag counts once.
    expect(resumed.body.attempt).toMatchObject({ id: first.body.id, answers: { mc: "b", tf: true }, flagged: ["tf"] });
    const list = await browser.call(courseQuizzes, { path: "/api/learn/courses/x/quizzes", params: { courseId: course.id } });
    expect(list.body).toEqual([
      expect.objectContaining({ slug: "check-up", question_count: 9, layout: "one_at_a_time", in_progress: { answered: 2, started_at: expect.any(String) }, last_result: null }),
    ]);

    // Submitting carries the last answers (sent with Finish) and marks them.
    const result = await submit(browser, first.body.id, { answers: RIGHT_ANSWERS, flagged: [] });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ attempt_id: first.body.id, score: AUTO_POINTS, max_score: AUTO_POINTS, pending_review: 1, pending_points: 3, answered: 9, question_count: 9 });

    // Frozen: saving again is refused, submitting again gives the same result.
    expect((await save(browser, first.body.id, { answers: { mc: "b" }, flagged: [] })).body.error.code).toBe("attempt_submitted");
    const repeat = await submit(browser, first.body.id, { answers: { mc: "b" } });
    expect(repeat.status).toBe(200);
    expect(repeat.body).toEqual(result.body);

    const stored = await getDb().quizAttempt.findUniqueOrThrow({ where: { id: first.body.id } });
    expect(stored).toMatchObject({ status: "submitted", score: AUTO_POINTS, maxScore: AUTO_POINTS, pendingReview: 1, flagged: [] });
    expect((stored.results as Record<string, unknown>).open).toEqual({ answered: true, correct: null, points: 0, max: 3 });

    // The course's list and the player now show the result; a new attempt starts fresh.
    const after = await view(browser, quiz.id);
    expect(after.body.attempt).toBeNull();
    expect(after.body.last_result).toMatchObject({ score: AUTO_POINTS, max_score: AUTO_POINTS });
    const retry = await start(browser, quiz.id);
    expect(retry.status).toBe(201);
    expect(retry.body.id).not.toBe(first.body.id);
    expect(retry.body.answers).toEqual({});
  });

  it("marks wrong and missing answers, using what was saved when Finish sends nothing", async () => {
    const { course, quiz } = await fractionsQuiz();
    const { browser } = await student();
    await enrollIn(browser, course.id);
    const attempt = (await start(browser, quiz.id)).body;
    await save(browser, attempt.id, {
      answers: { mc: "b", ms: ["two-quarters"], num: "10/2", blank: { top: "numerator", bottom: "" }, match: { "half-pizza": "f-half", "quarter-cake": "f-third" } },
      flagged: [],
    });
    const result = await submit(browser, attempt.id);
    // Only the numeric answer (10/2 = 5, 2 points) is right. A half-filled question scores nothing and isn't
    // answered (the blanks); a fully matched one with a wrong match is answered but wrong.
    expect(result.body).toMatchObject({ score: 2, max_score: AUTO_POINTS, answered: 4, question_count: 9, pending_review: 1 });
  });

  it("refuses answers that don't fit their question, and says which", async () => {
    const { course, quiz } = await fractionsQuiz();
    const { browser } = await student();
    await enrollIn(browser, course.id);
    const attempt = (await start(browser, quiz.id)).body;
    const cases: Array<[string, unknown]> = [
      ["mc", "zzz"],
      ["ms", ["a", "a"]],
      ["tf", "yes"],
      ["short", "x".repeat(81)],
      ["num", 5],
      ["blank", { nope: "x" }],
      ["match", { "half-pizza": "nowhere" }],
      ["order", ["eighth", "quarter"]],
      ["open", "x".repeat(501)],
    ];
    for (const [questionId, answer] of cases) {
      const response = await save(browser, attempt.id, { answers: { [questionId]: answer }, flagged: [] });
      expect(response.status, questionId).toBe(422);
      expect(response.body.error.details[0].field).toBe(`body.answers.${questionId}`);
    }
    expect((await save(browser, attempt.id, { answers: "nope" })).status).toBe(422);
  });

  it("keeps each student's attempts to themselves", async () => {
    const { course, quiz } = await fractionsQuiz();
    const maya = await student("maya");
    const sam = await student("sam");
    await enrollIn(maya.browser, course.id);
    await enrollIn(sam.browser, course.id);
    const attempt = (await start(maya.browser, quiz.id)).body;
    await save(maya.browser, attempt.id, { answers: { mc: "a" }, flagged: ["mc"] });

    expect((await save(sam.browser, attempt.id, { answers: {}, flagged: [] })).status).toBe(404);
    expect((await submit(sam.browser, attempt.id)).status).toBe(404);
    expect((await view(sam.browser, quiz.id)).body.attempt).toBeNull();
    expect((await start(sam.browser, quiz.id)).body.id).not.toBe(attempt.id);
  });

  it("only lets students in, hides quizzes of draft courses, and counts a finished quiz as a learning day", async () => {
    const { course, quiz } = await fractionsQuiz();
    const draft = await getDb().course.findUniqueOrThrow({ where: { slug: "secret-draft" } });
    const hidden = await getDb().quiz.create({ data: { courseId: draft.id, slug: "hidden", title: "Hidden", questions: QUESTIONS as unknown as Prisma.InputJsonArray } });
    const { browser } = await student();
    expect((await view(browser, hidden.id)).status).toBe(404);
    expect((await browser.call(courseQuizzes, { path: "/api/learn/courses/x/quizzes", params: { courseId: draft.id } })).status).toBe(404);
    expect((await view(browser, "not-a-uuid")).status).toBe(404);

    await createUser({ role: "parent", email: "p@example.test" });
    const parent = new Browser();
    await parent.call(login, { method: "POST", path: "/api/auth/login", body: { email: "p@example.test", password: PASSWORD } });
    expect((await view(parent, quiz.id)).status).toBe(403);

    await enrollIn(browser, course.id);
    const attempt = (await start(browser, quiz.id)).body;
    expect((await browser.call(summary, { path: "/api/learn/summary" })).body.streak_days).toBe(0);
    await submit(browser, attempt.id, { answers: { mc: "a" } });
    expect((await browser.call(summary, { path: "/api/learn/summary" })).body.streak_days).toBe(1);
  });

  it("lets a student who left the course see their result but not carry on", async () => {
    const { course, quiz } = await fractionsQuiz();
    const { browser } = await student();
    await enrollIn(browser, course.id);
    const attempt = (await start(browser, quiz.id)).body;
    await browser.call(unenroll, { method: "DELETE", path: "/api/learn/enrollments/x", params: { courseId: course.id } });
    const left = await view(browser, quiz.id);
    expect(left.body).toMatchObject({ enrolled: false, questions: [], attempt: null });
    expect((await start(browser, quiz.id)).body.error.code).toBe("not_enrolled");
    // Coming back picks up the same attempt.
    await enrollIn(browser, course.id);
    expect((await start(browser, quiz.id)).body.id).toBe(attempt.id);
  });

  it("refuses to start a quiz without questions", async () => {
    await createCatalog();
    const course = await getDb().course.findUniqueOrThrow({ where: { slug: "fractions" } });
    const empty = await getDb().quiz.create({ data: { courseId: course.id, slug: "empty", title: "Empty" } });
    const { browser } = await student();
    await enrollIn(browser, course.id);
    expect((await start(browser, empty.id)).body.error.code).toBe("quiz_empty");
  });
});
