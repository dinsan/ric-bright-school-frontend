import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { GET as courseProgress } from "@/app/api/learn/courses/[courseId]/progress/route";
import { DELETE as unenroll } from "@/app/api/learn/enrollments/[courseId]/route";
import { GET as listEnrollments, POST as enroll } from "@/app/api/learn/enrollments/route";
import { PUT as reportLesson } from "@/app/api/learn/lessons/[lessonId]/progress/route";
import { GET as summary } from "@/app/api/learn/summary/route";
import { localDay, addDays } from "@/features/learn/analytics";
import { getDb } from "@/server/db";
import { Browser } from "../support/browser";
import { createCatalog, createUser, PASSWORD } from "../support/factories";

async function student(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser({ role: "student", username: "kid1", ...overrides });
  const browser = new Browser();
  expect((await browser.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username: user.username, password: PASSWORD } })).status).toBe(200);
  return { user, browser };
}

async function course(slug: string) {
  const row = await getDb().course.findUniqueOrThrow({ where: { slug }, include: { lessons: { orderBy: { position: "asc" } } } });
  return row;
}

const report = (browser: Browser, lessonId: string, body: unknown) =>
  browser.call(reportLesson, { method: "PUT", path: "/api/learn/lessons/x/progress", params: { lessonId }, body });

describe("learning API: access", () => {
  it("is for signed-in students only", async () => {
    await createCatalog();
    expect((await new Browser().call(listEnrollments, { path: "/api/learn/enrollments" })).status).toBe(401);
    await createUser({ email: "mum@example.test" });
    const parent = new Browser();
    await parent.call(login, { method: "POST", path: "/api/auth/login", body: { email: "mum@example.test", password: PASSWORD } });
    expect((await parent.call(listEnrollments, { path: "/api/learn/enrollments" })).status).toBe(403);
    expect((await parent.call(summary, { path: "/api/learn/summary" })).status).toBe(403);
  });
});

describe("learning API: enrolments", () => {
  it("enrols once (a repeat answers 200 with the same enrolment), lists it with progress, and hides drafts", async () => {
    await createCatalog();
    const { browser } = await student();
    const fractions = await course("fractions");

    const first = await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      course: { slug: "fractions", grade_level: 4, subject: { slug: "mathematics" } },
      completed_at: null,
      progress: { lessons_total: 2, lessons_completed: 0, percent: 0, next_lesson: { slug: "what-is-a-fraction" } },
    });
    expect((await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } })).status).toBe(200);
    const list = await browser.call(listEnrollments, { path: "/api/learn/enrollments" });
    expect(list.body).toHaveLength(1);

    const draft = await course("secret-draft");
    expect((await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: draft.id } })).status).toBe(404);
    expect((await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: "nope" } })).status).toBe(422);
  });

  it("unenrols, keeping progress for a later return", async () => {
    await createCatalog();
    const { browser } = await student();
    const fractions = await course("fractions");
    await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } });
    await report(browser, fractions.lessons[0]!.id, { status: "completed" });

    expect((await browser.call(unenroll, { method: "DELETE", path: "/api/learn/enrollments/x", params: { courseId: fractions.id } })).status).toBe(204);
    expect((await browser.call(listEnrollments, { path: "/api/learn/enrollments" })).body).toEqual([]);
    expect((await browser.call(unenroll, { method: "DELETE", path: "/api/learn/enrollments/x", params: { courseId: fractions.id } })).status).toBe(404);

    const back = await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } });
    expect(back.body.progress).toMatchObject({ lessons_completed: 1, percent: 50, next_lesson: { slug: "equivalent-fractions" } });
  });
});

describe("learning API: progress", () => {
  it("needs an enrolment before lessons can record progress", async () => {
    await createCatalog();
    const { browser } = await student();
    const fractions = await course("fractions");
    const refused = await report(browser, fractions.lessons[0]!.id, { status: "started" });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("not_enrolled");
    // A draft course's lesson doesn't exist for students.
    const draft = await course("secret-draft");
    expect((await report(browser, draft.lessons[0]!.id, { status: "started" })).status).toBe(404);
  });

  it("is idempotent: completed stays completed, time adds up, a repeated 'done' counts once", async () => {
    await createCatalog();
    const { user, browser } = await student();
    const fractions = await course("fractions");
    const lessonId = fractions.lessons[0]!.id;
    await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } });

    expect((await report(browser, lessonId, { status: "started", seconds: 30 })).body).toMatchObject({ status: "started", seconds_spent: 30, completed_at: null });
    const done = await report(browser, lessonId, { status: "completed", seconds: 45 });
    expect(done.body).toMatchObject({ status: "completed", seconds_spent: 75, course_completed: false });
    expect(done.body.completed_at).toBeTruthy();
    const again = await report(browser, lessonId, { status: "completed", seconds: 0 });
    const reopened = await report(browser, lessonId, { status: "started", seconds: 15 });
    expect(reopened.body).toMatchObject({ status: "completed", seconds_spent: 90, completed_at: done.body.completed_at });
    expect(again.body.completed_at).toBe(done.body.completed_at);

    const days = await getDb().learningDay.findMany({ where: { studentId: user.id } });
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ secondsSpent: 90, lessonsCompleted: 1 });
  });

  // R: simultaneous reports (a retry queue, two tabs) each read "not completed yet" and counted the
  // lesson again; finishing the last two lessons at once could also miss completing the course.
  it("counts each lesson once and completes the course when reports arrive at the same time", async () => {
    await createCatalog();
    const { user, browser } = await student();
    const fractions = await course("fractions");
    await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } });
    const results = await Promise.all(
      fractions.lessons.flatMap((lesson) => Array.from({ length: 4 }, () => report(browser, lesson.id, { status: "completed", seconds: 10 }))),
    );
    expect(results.every((result) => result.status === 200)).toBe(true);
    expect(results.filter((result) => result.body.course_completed)).toHaveLength(1);
    const day = await getDb().learningDay.findFirstOrThrow({ where: { studentId: user.id } });
    expect(day).toMatchObject({ lessonsCompleted: 2, secondsSpent: 80 });
    const list = await browser.call(listEnrollments, { path: "/api/learn/enrollments" });
    expect(list.body[0].completed_at).toBeTruthy();
  });

  it("refuses reports that aren't progress", async () => {
    await createCatalog();
    const { browser } = await student();
    const fractions = await course("fractions");
    await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } });
    for (const body of [{ status: "finished" }, { status: "started", seconds: -1 }, { status: "started", seconds: 15 * 60 + 1 }]) {
      expect((await report(browser, fractions.lessons[0]!.id, body)).status).toBe(422);
    }
    expect((await report(browser, crypto.randomUUID(), { status: "started" })).status).toBe(404);
  });

  it("shows the outline with statuses, resumes the last lesson opened, and completes the course with its last lesson", async () => {
    await createCatalog();
    const { browser } = await student();
    const fractions = await course("fractions");
    const [first, second] = fractions.lessons;
    await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } });

    await report(browser, second!.id, { status: "started" });
    let outline = await browser.call(courseProgress, { path: "/api/learn/courses/x/progress", params: { courseId: fractions.id } });
    expect(outline.body.enrolled).toBe(true);
    expect(outline.body.lessons.map((lesson: { status: string }) => lesson.status)).toEqual(["not_started", "started"]);
    expect(outline.body.summary.next_lesson.id).toBe(second!.id); // resume where you left off

    await report(browser, first!.id, { status: "completed" });
    const last = await report(browser, second!.id, { status: "completed" });
    expect(last.body.course_completed).toBe(true);
    outline = await browser.call(courseProgress, { path: "/api/learn/courses/x/progress", params: { courseId: fractions.id } });
    expect(outline.body.summary).toMatchObject({ percent: 100, next_lesson: null });
    const list = await browser.call(listEnrollments, { path: "/api/learn/enrollments" });
    expect(list.body[0].completed_at).toBeTruthy();
  });

  it("shows a published course's outline before enrolment (enrolled: false), but never a draft's", async () => {
    await createCatalog();
    const { browser } = await student();
    const plants = await course("plants");
    const outline = await browser.call(courseProgress, { path: "/api/learn/courses/x/progress", params: { courseId: plants.id } });
    expect(outline.body).toMatchObject({ enrolled: false, summary: { lessons_total: 1, percent: 0 } });
    const draft = await course("secret-draft");
    expect((await browser.call(courseProgress, { path: "/api/learn/courses/x/progress", params: { courseId: draft.id } })).status).toBe(404);
  });

  it("keeps each student's progress their own", async () => {
    await createCatalog();
    const maya = await student({ username: "maya1" });
    const leo = await student({ username: "leo1" });
    const fractions = await course("fractions");
    for (const { browser } of [maya, leo]) await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } });
    await report(maya.browser, fractions.lessons[0]!.id, { status: "completed" });
    const leoOutline = await leo.browser.call(courseProgress, { path: "/api/learn/courses/x/progress", params: { courseId: fractions.id } });
    expect(leoOutline.body.summary.lessons_completed).toBe(0);
  });
});

describe("learning API: summary", () => {
  it("starts empty", async () => {
    const { browser } = await student();
    const { body } = await browser.call(summary, { path: "/api/learn/summary" });
    expect(body).toEqual({
      streak_days: 0,
      longest_streak_days: 0,
      xp: 0,
      level: { level: 1, xp_into_level: 0, xp_for_next_level: 100 },
      lessons_completed: 0,
      courses_completed: 0,
      minutes_last_7_days: 0,
      continue_learning: null,
      minutes_total: 0,
      badges_earned: 0,
      certificates: 0,
      review_due: 0,
      notes_count: 0,
      bookmarks_count: 0,
    });
  });

  it("adds up XP, streaks (in the student's time zone), minutes and where to continue", async () => {
    await createCatalog();
    const timezone = "Pacific/Auckland";
    const { user, browser } = await student({ timezone });
    const fractions = await course("fractions");
    const counting = await course("counting");
    for (const id of [fractions.id, counting.id]) await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: id } });

    await report(browser, counting.lessons[0]!.id, { status: "completed", seconds: 120 }); // finishes "counting" (one lesson)
    await report(browser, fractions.lessons[0]!.id, { status: "completed", seconds: 300 });

    // Two earlier days of learning make a three-day streak with today.
    const today = localDay(new Date(), timezone);
    await getDb().learningDay.createMany({
      data: [1, 2].map((ago) => ({ studentId: user.id, day: new Date(`${addDays(today, -ago)}T00:00:00Z`), secondsSpent: 60 })),
    });

    const { body } = await browser.call(summary, { path: "/api/learn/summary" });
    expect(body).toMatchObject({
      streak_days: 3,
      longest_streak_days: 3,
      lessons_completed: 2,
      courses_completed: 1,
      xp: 2 * 10 + 50,
      level: { level: 1, xp_into_level: 70 },
      minutes_last_7_days: 9, // 420 s today + 120 s before
      continue_learning: { course: { slug: "fractions" }, lesson: { slug: "equivalent-fractions" } },
    });
    const days = await getDb().learningDay.findMany({ where: { studentId: user.id }, orderBy: { day: "desc" } });
    expect(days[0]!.day.toISOString().slice(0, 10)).toBe(today);
  });
});
