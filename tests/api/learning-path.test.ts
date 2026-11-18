import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { GET as assignments } from "@/app/api/learn/assignments/route";
import { GET as courseProgress } from "@/app/api/learn/courses/[courseId]/progress/route";
import { POST as enroll } from "@/app/api/learn/enrollments/route";
import { PUT as reportLesson } from "@/app/api/learn/lessons/[lessonId]/progress/route";
import { GET as path } from "@/app/api/learn/path/route";
import { GET as recommendations } from "@/app/api/learn/recommendations/route";
import { POST as answer } from "@/app/api/learn/review/[itemId]/answer/route";
import { GET as reviewOverview } from "@/app/api/learn/review/route";
import { GET as reviewSession } from "@/app/api/learn/review/session/route";
import { GET as summary } from "@/app/api/learn/summary/route";
import { DELETE as deleteAssignment } from "@/app/api/teach/assignments/[assignmentId]/route";
import { GET as classAssignments, POST as createAssignment } from "@/app/api/teach/classes/[classId]/assignments/route";
import { GET as classes } from "@/app/api/teach/classes/route";
import { getDb } from "@/server/db";
import { Browser } from "../support/browser";
import { createCatalog, createClass, createUser, PASSWORD } from "../support/factories";

async function student(username = "kid1", overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser({ role: "student", username, displayName: "Maya", ...overrides });
  const browser = new Browser();
  expect((await browser.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username, password: PASSWORD } })).status).toBe(200);
  return { user, browser };
}

async function teacher(email = "t@example.test", verified = true) {
  const user = await createUser({ role: "teacher", email });
  if (verified) await getDb().teacherProfile.update({ where: { userId: user.id }, data: { verifiedAt: new Date() } });
  const browser = new Browser();
  expect((await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password: PASSWORD } })).status).toBe(200);
  return { user, browser };
}

const course = (slug: string) => getDb().course.findUniqueOrThrow({ where: { slug }, include: { lessons: { orderBy: { position: "asc" } }, subject: true } });
const start = (browser: Browser, courseId: string) => browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: courseId } });
const report = (browser: Browser, lessonId: string, body: unknown) => browser.call(reportLesson, { method: "PUT", path: "/api/learn/lessons/x/progress", params: { lessonId }, body });

/** A maths path on top of the test catalog: Counting (1) → Fractions (4) → Decimals (5, new) → Ratios (6, new). */
async function mathsPath() {
  await createCatalog();
  const maths = await getDb().subject.findUniqueOrThrow({ where: { slug: "mathematics" } });
  const [counting, fractions] = await Promise.all([course("counting"), course("fractions")]);
  const make = (slug: string, title: string, gradeLevel: number) =>
    getDb().course.create({ data: { slug, title, summary: `${title}.`, gradeLevel, subjectId: maths.id, status: "published", publishedAt: new Date(), lessons: { create: [{ slug: `${slug}-1`, title: `${title} 1`, summary: "x", position: 1 }] } } });
  const decimals = await make("decimals", "Decimals", 5);
  const ratios = await make("ratios", "Ratios", 6);
  await getDb().coursePrerequisite.createMany({
    data: [
      { courseId: fractions.id, requiresCourseId: counting.id },
      { courseId: decimals.id, requiresCourseId: fractions.id },
      { courseId: ratios.id, requiresCourseId: decimals.id },
    ],
  });
  return { counting, fractions, decimals, ratios };
}

describe("learning path API", () => {
  it("shows a subject's courses in order, what's done, next and locked (and why)", async () => {
    const { decimals, ratios } = await mathsPath();
    const { browser } = await student("kid5", { gradeLevel: 5 });
    const view = await browser.call(path, { path: "/api/learn/path?subject=mathematics" });
    expect(view.status).toBe(200);
    expect(view.body.subject.slug).toBe("mathematics");
    expect(view.body.subjects.map((subject: { slug: string }) => subject.slug)).toEqual(["mathematics", "science"]);
    expect(view.body.steps.map((step: { course: { slug: string }; status: string }) => [step.course.slug, step.status])).toEqual([
      ["counting", "available"],
      ["fractions", "available"],
      ["decimals", "next"],
      ["ratios", "locked"],
    ]);
    expect(view.body.steps[3].locked_reason).toBe("Finish Decimals (Grade 5) first.");
    expect(view.body.steps[0]).toMatchObject({ earlier_grade: true, lessons_total: 1, lessons_done: 0 });

    // A locked course can't be started, and says why everywhere.
    const refused = await start(browser, ratios.id);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatchObject({ code: "course_locked", message: "Finish Decimals (Grade 5) first." });
    const outline = await browser.call(courseProgress, { path: "/api/learn/courses/x/progress", params: { courseId: ratios.id } });
    expect(outline.body.locked_reason).toBe("Finish Decimals (Grade 5) first.");

    // Finishing Decimals opens Ratios.
    await start(browser, decimals.id);
    await report(browser, (await course("decimals")).lessons[0]!.id, { status: "completed" });
    expect((await start(browser, ratios.id)).status).toBe(201);
    const after = await browser.call(path, { path: "/api/learn/path?subject=mathematics" });
    expect(after.body.steps.map((step: { status: string }) => step.status)).toEqual(["available", "available", "done", "in_progress"]);
    expect((await browser.call(path, { path: "/api/learn/path?subject=astrology" })).status).toBe(404);
  });

  it("defaults to the subject the student was last active in", async () => {
    await createCatalog();
    const plants = await course("plants");
    const { browser } = await student();
    await start(browser, plants.id);
    expect((await browser.call(path, { path: "/api/learn/path" })).body.subject.slug).toBe("science");
  });

  it("recommends the next step of the path first, with its reason, never what's taken or locked", async () => {
    const { fractions } = await mathsPath();
    const { browser } = await student("kid4", { gradeLevel: 4 });
    await start(browser, fractions.id);
    await report(browser, fractions.lessons[0]!.id, { status: "completed" });
    await report(browser, fractions.lessons[1]!.id, { status: "completed" });
    const picks = await browser.call(recommendations, { path: "/api/learn/recommendations" });
    expect(picks.status).toBe(200);
    expect(picks.body[0]).toMatchObject({ course: { slug: "decimals" }, reason: "Next after Fractions Made Simple" });
    const slugs = picks.body.map((pick: { course: { slug: string } }) => pick.course.slug);
    expect(slugs).not.toContain("fractions");
    expect(slugs).not.toContain("ratios"); // locked until Decimals
    expect(slugs).not.toContain("secret-draft");
    expect(picks.body.length).toBeLessThanOrEqual(3);
  });
});

describe("assignments API", () => {
  it("lets a verified teacher set work for their own class, and shows each student's progress", async () => {
    await createCatalog();
    const fractions = await course("fractions");
    const { user: maya, browser: mayaBrowser } = await student("maya1");
    const { user: leo } = await student("leo1", { displayName: "Leo" });
    const { user: teacherUser, browser: teacherBrowser } = await teacher();
    const klass = await createClass(teacherUser, [maya, leo], "ASSN42");

    expect((await teacherBrowser.call(classes, { path: "/api/teach/classes" })).body).toEqual([{ id: klass.id, name: "Class 1T", code: "ASSN42", students: 2 }]);
    const due = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const created = await teacherBrowser.call(createAssignment, {
      method: "POST",
      path: "/api/teach/classes/x/assignments",
      params: { classId: klass.id },
      body: { course_id: fractions.id, lesson_id: fractions.lessons[0]!.id, due_at: due, instructions: "Watch the video first." },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: "What is a fraction?", lesson: { slug: "what-is-a-fraction" }, done_count: 0 });
    expect(created.body.students.map((entry: { display_name: string; status: string }) => [entry.display_name, entry.status])).toEqual([
      ["Leo", "not_started"],
      ["Maya", "not_started"],
    ]);

    // The student sees it, then does it.
    const mine = await mayaBrowser.call(assignments, { path: "/api/learn/assignments" });
    expect(mine.body).toEqual([
      expect.objectContaining({
        title: "What is a fraction?",
        instructions: "Watch the video first.",
        class_name: "Class 1T",
        teacher_name: teacherUser.displayName,
        status: "not_started",
        lessons_done: 0,
        lessons_total: 1,
        href: "/learn/courses/fractions/lessons/what-is-a-fraction",
      }),
    ]);
    await start(mayaBrowser, fractions.id);
    await report(mayaBrowser, fractions.lessons[0]!.id, { status: "completed" });
    expect((await mayaBrowser.call(assignments, { path: "/api/learn/assignments" })).body[0].status).toBe("done");
    const progress = await teacherBrowser.call(classAssignments, { path: "/api/teach/classes/x/assignments", params: { classId: klass.id } });
    expect(progress.body[0].done_count).toBe(1);

    // Deleting it removes it for the class.
    expect((await teacherBrowser.call(deleteAssignment, { method: "DELETE", path: "/api/teach/assignments/x", params: { assignmentId: created.body.id } })).status).toBe(204);
    expect((await mayaBrowser.call(assignments, { path: "/api/learn/assignments" })).body).toEqual([]);
  });

  it("refuses unverified teachers, other teachers' classes, past dates and lessons of another course", async () => {
    await createCatalog();
    const [fractions, plants] = await Promise.all([course("fractions"), course("plants")]);
    const { user: owner } = await teacher("owner@example.test");
    const klass = await createClass(owner, [], "OWNR42");
    const { browser: other } = await teacher("other@example.test");
    const { browser: unverified } = await teacher("new@example.test", false);
    const body = { course_id: fractions.id, due_at: new Date(Date.now() + 86_400_000).toISOString() };
    const post = (browser: Browser, payload: unknown) => browser.call(createAssignment, { method: "POST", path: "/api/teach/classes/x/assignments", params: { classId: klass.id }, body: payload });

    expect((await unverified.call(classes, { path: "/api/teach/classes" })).status).toBe(403);
    expect((await post(other, body)).status).toBe(404);
    const ownerBrowser = new Browser();
    await ownerBrowser.call(login, { method: "POST", path: "/api/auth/login", body: { email: "owner@example.test", password: PASSWORD } });
    const past = await post(ownerBrowser, { ...body, due_at: new Date(Date.now() - 86_400_000).toISOString() });
    expect(past.status).toBe(400);
    expect(past.body.error.details[0].field).toBe("body.due_at");
    const wrongLesson = await post(ownerBrowser, { ...body, lesson_id: plants.lessons[0]!.id });
    expect(wrongLesson.body.error.details[0].field).toBe("body.lesson_id");
    const draft = await course("secret-draft");
    expect((await post(ownerBrowser, { ...body, course_id: draft.id })).body.error.details[0].field).toBe("body.course_id");
    // Students only ever see work for their own classes; teachers can't use the student API.
    const { browser: outsider } = await student("outsider");
    await post(ownerBrowser, body);
    expect((await outsider.call(assignments, { path: "/api/learn/assignments" })).body).toEqual([]);
    expect((await ownerBrowser.call(assignments, { path: "/api/learn/assignments" })).status).toBe(403);
  });
});

describe("review and practice API", () => {
  const CHECK = (id: string, answer = "b") => ({
    id,
    type: "check",
    prompt: `Question ${id}?`,
    options: [
      { id: "a", text: "Wrong" },
      { id: "b", text: "Right" },
    ],
    answer,
    explanation: "Because.",
  });

  async function finishedLesson(daysAgo = 2) {
    await createCatalog();
    const fractions = await course("fractions");
    await getDb().lesson.update({ where: { id: fractions.lessons[0]!.id }, data: { content: [{ id: "intro", type: "text", paragraphs: ["x"] }, CHECK("q1"), CHECK("q2")] } });
    const { user, browser } = await student();
    await start(browser, fractions.id);
    await report(browser, fractions.lessons[0]!.id, { status: "completed" });
    // Pretend it was finished `daysAgo` days ago, so its questions are due.
    await getDb().reviewItem.updateMany({ where: { studentId: user.id }, data: { dueAt: new Date(Date.now() - (daysAgo - 1) * 86_400_000) } });
    return { user, browser, fractions };
  }

  it("queues a finished lesson's quick checks for review", async () => {
    await createCatalog();
    const fractions = await course("fractions");
    await getDb().lesson.update({ where: { id: fractions.lessons[0]!.id }, data: { content: [CHECK("q1")] } });
    const { browser } = await student();
    await start(browser, fractions.id);
    await report(browser, fractions.lessons[0]!.id, { status: "completed" });
    const overview = await browser.call(reviewOverview, { path: "/api/learn/review" });
    expect(overview.body).toMatchObject({ due_count: 0, total_count: 1, courses: [{ course: { slug: "fractions" }, questions: 1, due: 0 }] });
    expect(new Date(overview.body.next_due_at).getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000); // tomorrow
  });

  it("asks due questions without giving the answer away, checks answers and reschedules them", async () => {
    const { browser } = await finishedLesson();
    expect((await browser.call(summary, { path: "/api/learn/summary" })).body.review_due).toBe(2);
    const session = await browser.call(reviewSession, { path: "/api/learn/review/session?mode=review" });
    expect(session.body.questions).toHaveLength(2);
    expect(session.body.questions[0]).toMatchObject({ prompt: "Question q1?", strength: "new", course: { slug: "fractions" } });
    expect(JSON.stringify(session.body)).not.toContain('"answer"');

    const [first, second] = session.body.questions;
    const right = await browser.call(answer, { method: "POST", path: "/api/learn/review/x/answer", params: { itemId: first.id }, body: { choice: "b", mode: "review" } });
    expect(right.body).toMatchObject({ correct: true, answer: "b", explanation: "Because.", scheduled: true, interval_days: 3, strength: "learning" });
    const wrong = await browser.call(answer, { method: "POST", path: "/api/learn/review/x/answer", params: { itemId: second.id }, body: { choice: "a", mode: "review" } });
    expect(wrong.body).toMatchObject({ correct: false, answer: "b", interval_days: 1, strength: "new" });
    const overview = await browser.call(reviewOverview, { path: "/api/learn/review" });
    expect(overview.body.due_count).toBe(0);
    expect((await browser.call(reviewSession, { path: "/api/learn/review/session?mode=review" })).body.questions).toEqual([]);
  });

  it("practice: any question, weakest first, and answers never change the schedule", async () => {
    const { user, browser, fractions } = await finishedLesson();
    await getDb().reviewItem.updateMany({ where: { studentId: user.id, blockId: "q1" }, data: { box: 3 } });
    const before = await getDb().reviewItem.findMany({ where: { studentId: user.id }, orderBy: { blockId: "asc" } });
    const session = await browser.call(reviewSession, { path: `/api/learn/review/session?mode=practice&course_id=${fractions.id}` });
    expect(session.body.questions.map((question: { prompt: string }) => question.prompt)).toEqual(["Question q2?", "Question q1?"]);
    const result = await browser.call(answer, { method: "POST", path: "/api/learn/review/x/answer", params: { itemId: session.body.questions[0].id }, body: { choice: "b", mode: "practice" } });
    expect(result.body).toMatchObject({ correct: true, scheduled: false });
    expect(await getDb().reviewItem.findMany({ where: { studentId: user.id }, orderBy: { blockId: "asc" } })).toEqual(before);
  });

  it("refuses other students' questions and answers that aren't options, and skips questions removed from a lesson", async () => {
    const { browser, fractions } = await finishedLesson();
    const session = await browser.call(reviewSession, { path: "/api/learn/review/session?mode=review" });
    const itemId = session.body.questions[0].id;
    const { browser: other } = await student("other");
    expect((await other.call(answer, { method: "POST", path: "/api/learn/review/x/answer", params: { itemId }, body: { choice: "b" } })).status).toBe(404);
    const invalid = await browser.call(answer, { method: "POST", path: "/api/learn/review/x/answer", params: { itemId }, body: { choice: "z" } });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details[0].field).toBe("body.choice");
    // The author removes q1 from the lesson: it silently leaves the session.
    await getDb().lesson.update({ where: { id: fractions.lessons[0]!.id }, data: { content: [CHECK("q2")] } });
    const after = await browser.call(reviewSession, { path: "/api/learn/review/session?mode=review" });
    expect(after.body.questions.map((question: { prompt: string }) => question.prompt)).toEqual(["Question q2?"]);
  });

  it("brings in questions of lessons finished before review existed", async () => {
    await createCatalog();
    const fractions = await course("fractions");
    await getDb().lesson.update({ where: { id: fractions.lessons[0]!.id }, data: { content: [CHECK("q1")] } });
    const { user, browser } = await student();
    await getDb().enrollment.create({ data: { studentId: user.id, courseId: fractions.id } });
    await getDb().lessonProgress.create({ data: { studentId: user.id, lessonId: fractions.lessons[0]!.id, status: "completed", completedAt: new Date(Date.now() - 5 * 86_400_000) } });
    expect((await browser.call(reviewOverview, { path: "/api/learn/review" })).body).toMatchObject({ due_count: 1, total_count: 1 });
  });
});
