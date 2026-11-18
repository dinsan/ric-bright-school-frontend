import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { GET as studentControls } from "@/app/api/learn/controls/route";
import { POST as enroll } from "@/app/api/learn/enrollments/route";
import { PUT as reportLesson } from "@/app/api/learn/lessons/[lessonId]/progress/route";
import { POST as submitAttempt } from "@/app/api/learn/quiz-attempts/[attemptId]/submit/route";
import { POST as startAttempt } from "@/app/api/learn/quizzes/[quizId]/attempts/route";
import { GET as studentSummary } from "@/app/api/learn/summary/route";
import { GET as readControls, PUT as writeControls } from "@/app/api/me/children/[id]/controls/route";
import { GET as childData } from "@/app/api/me/children/[id]/data/route";
import { GET as progress } from "@/app/api/me/children/[id]/progress/route";
import { GET as report } from "@/app/api/me/children/[id]/report/route";
import { DELETE as deleteChild } from "@/app/api/me/children/[id]/route";
import { GET as overview } from "@/app/api/me/children/overview/route";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import { addDays, localDay } from "@/features/learn/analytics";
import { Browser } from "../support/browser";
import { createCatalog, createClass, createUser, linkChild, PASSWORD } from "../support/factories";
import { QUESTIONS, RIGHT_ANSWERS } from "../support/quiz";

const DAY = 86_400_000;

async function signedIn(email: string) {
  const browser = new Browser();
  expect((await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password: PASSWORD } })).status).toBe(200);
  return browser;
}

const course = (slug: string) => getDb().course.findUniqueOrThrow({ where: { slug }, include: { lessons: { orderBy: { position: "asc" } } } });

/**
 * A parent and a child with real learning, made through the child's own API where possible: two courses
 * started (one finished, with its certificate), lessons with time, a quiz, work set by a teacher (one piece
 * overdue), review questions missed twice, and an earlier day of learning.
 */
async function family() {
  await createCatalog();
  const parentUser = await createUser({ email: "mum@example.test", displayName: "Pat Parent" });
  const child = await createUser({ role: "student", username: "leo", displayName: "Leo", gradeLevel: 4, timezone: "UTC" });
  await linkChild(parentUser, child);
  const kid = new Browser();
  expect((await kid.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username: "leo", password: PASSWORD } })).status).toBe(200);

  const [fractions, counting] = await Promise.all([course("fractions"), course("counting")]);
  for (const id of [fractions.id, counting.id]) await kid.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: id } });
  const done = (lessonId: string, seconds: number) =>
    kid.call(reportLesson, { method: "PUT", path: "/api/learn/lessons/x/progress", params: { lessonId }, body: { status: "completed", seconds } });
  expect((await done(fractions.lessons[0]!.id, 600)).status).toBe(200);
  expect((await done(counting.lessons[0]!.id, 300)).body.course_completed).toBe(true);

  const quiz = await getDb().quiz.create({ data: { courseId: fractions.id, slug: "check", title: "Fractions check-up", questions: QUESTIONS as unknown as Prisma.InputJsonArray } });
  const attempt = (await kid.call(startAttempt, { method: "POST", path: "/api/learn/quizzes/x/attempts", params: { quizId: quiz.id } })).body;
  // Half right: multiple choice, true/false, short answer and numeric (1 + 1 + 1 + 2 of 9 points).
  const answers = { mc: RIGHT_ANSWERS.mc, tf: RIGHT_ANSWERS.tf, short: RIGHT_ANSWERS.short, num: RIGHT_ANSWERS.num, ms: ["one-third"] };
  expect((await kid.call(submitAttempt, { method: "POST", path: "/api/learn/quiz-attempts/x/submit", params: { attemptId: attempt.id }, body: { answers } })).status).toBe(200);

  const today = localDay(new Date(), "UTC");
  await getDb().learningDay.create({ data: { studentId: child.id, day: new Date(`${addDays(today, -3)}T00:00:00Z`), secondsSpent: 1200, lessonsCompleted: 0 } });
  await getDb().reviewItem.create({ data: { studentId: child.id, lessonId: fractions.lessons[0]!.id, blockId: "check", lapses: 2, reps: 3, dueAt: new Date() } });

  const teacher = await createUser({ role: "teacher", email: "sir@example.test", displayName: "Tom Teacher" });
  const klass = await createClass(teacher, [child], "DASH42");
  await getDb().assignment.createMany({
    data: [
      { classId: klass.id, teacherId: teacher.id, courseId: fractions.id, lessonId: fractions.lessons[1]!.id, title: "Equivalent fractions homework", dueAt: new Date(Date.now() - 2 * DAY) },
      { classId: klass.id, teacherId: teacher.id, courseId: fractions.id, title: "Finish Fractions", dueAt: new Date(Date.now() + 3 * DAY) },
    ],
  });
  const parent = await signedIn("mum@example.test");
  return { parent, parentUser, kid, child, fractions, counting, quiz, today };
}

const progressOf = (parent: Browser, childId: string, days?: number) =>
  parent.call(progress, { path: `/api/me/children/x/progress${days ? `?days=${days}` : ""}`, params: { id: childId } });

describe("parent dashboard API", () => {
  it("shows each child's week on the dashboard, with the same numbers the child sees", async () => {
    const { parent, kid, child } = await family();
    const second = await createUser({ role: "student", username: "mia", displayName: "Mia", gradeLevel: 2 });
    await linkChild(await getDb().user.findUniqueOrThrow({ where: { email: "mum@example.test" } }), second);

    const cards = await parent.call(overview, { path: "/api/me/children/overview" });
    expect(cards.status).toBe(200);
    expect(cards.body.map((card: { child: { display_name: string } }) => card.child.display_name)).toEqual(["Leo", "Mia"]);
    const leo = cards.body[0];
    expect(leo).toMatchObject({
      child: { id: child.id, display_name: "Leo", grade_level: 4, username: "leo" },
      minutes_last_7_days: 35, // 10 + 5 today, 20 three days ago
      lessons_completed: 2,
      courses_in_progress: 1,
      courses_completed: 1,
      latest_quiz: { quiz: "Fractions check-up", course: "Fractions Made Simple", status: "submitted", score: 5, max_score: 9, percent: 56, pending_review: 1 },
      work: { overdue: 1, due_soon: 1 },
      controls: { daily_minutes: null, bedtime: null, when_reached: "remind" },
    });
    expect(leo.last_active_at).toEqual(expect.any(String));
    expect(cards.body[1]).toMatchObject({ last_active_at: null, minutes_last_7_days: 0, lessons_completed: 0, latest_quiz: null, work: { overdue: 0, due_soon: 0 } });

    // Accurate: exactly what the child's own dashboard says.
    const own = (await kid.call(studentSummary, { path: "/api/learn/summary" })).body;
    expect(leo).toMatchObject({ streak_days: own.streak_days, minutes_last_7_days: own.minutes_last_7_days, lessons_completed: own.lessons_completed, level: own.level.level });
  });

  it("shows a child's courses, quiz results, work, learning time, activity and insights", async () => {
    const { parent, child, today } = await family();
    const response = await progressOf(parent, child.id);
    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.period).toEqual({ days: 14, from: addDays(today, -13), to: today, minutes: 35, active_days: 2, lessons_completed: 2, quizzes_finished: 1 });
    expect(body.learning_days).toHaveLength(14);
    expect(body.learning_days.at(-1)).toEqual({ day: today, minutes: 15, lessons_completed: 2 });
    expect(body.learning_days.at(-4)).toEqual({ day: addDays(today, -3), minutes: 20, lessons_completed: 0 });
    expect(body.summary).toMatchObject({ streak_days: 1, lessons_completed: 2, courses_completed: 1, xp: 70, level: 1, badges_earned: 2, quiz_average_percent: 56, minutes_total: 35 });

    expect(body.courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Fractions Made Simple", subject: "Mathematics", lessons_total: 2, lessons_completed: 1, percent: 50, completed_at: null, next_lesson: "Equivalent fractions" }),
        expect.objectContaining({ title: "Counting to 100", lessons_total: 1, lessons_completed: 1, percent: 100, completed_at: expect.any(String), next_lesson: null }),
      ]),
    );
    expect(body.quizzes).toEqual([
      expect.objectContaining({ quiz: "Fractions check-up", status: "submitted", score: 5, max_score: 9, percent: 56, pending_review: 1, question_count: 9 }),
    ]);
    expect(body.assignments.map((row: { title: string; due_tone: string; status: string }) => [row.title, row.due_tone, row.status])).toEqual([
      ["Equivalent fractions homework", "overdue", "not_started"],
      ["Finish Fractions", "soon", "in_progress"],
    ]);
    expect(body.assignments[0]).toMatchObject({ class_name: "Class 1T", teacher_name: "Tom Teacher", due_label: "Overdue by 2 days", lesson: "Equivalent fractions" });
    expect(body.badges.map((badge: { name: string }) => badge.name).sort()).toEqual(["Course champion", "First step"]);
    expect(body.certificates).toEqual([expect.objectContaining({ course: "Counting to 100" })]);

    const kinds = body.activity.map((item: { kind: string }) => item.kind);
    expect(kinds).toEqual(expect.arrayContaining(["course_started", "lesson_completed", "quiz_finished", "badge", "certificate"]));
    expect(body.activity.map((item: { at: string }) => item.at)).toEqual([...body.activity.map((item: { at: string }) => item.at)].sort().reverse());
    expect(body.activity).toContainEqual(expect.objectContaining({ kind: "quiz_finished", text: "Finished the quiz “Fractions check-up”: 5 of 9 points (56%)" }));

    expect(body.insights.doing_well).toContain("Finished the course “Counting to 100”.");
    expect(body.insights.to_practise).toEqual([
      "The quiz “Fractions check-up” (56%): worth taking again.",
      "Review questions from “What is a fraction?” were missed more than once.",
      "“Equivalent fractions homework” from school is overdue.",
    ]);
    // The child's answers and sign-in secrets aren't part of the parent's view (the data copy has the answers).
    const raw = JSON.stringify(body).toLowerCase();
    for (const secret of ["denominator", "hash", "answers"]) expect(raw).not.toContain(secret);
  });

  it("covers the period asked for, and refuses periods out of range", async () => {
    const { parent, child, today } = await family();
    const week = (await progressOf(parent, child.id, 2)).body;
    expect(week.period).toMatchObject({ days: 2, from: addDays(today, -1), minutes: 15, active_days: 1 });
    expect(week.learning_days).toHaveLength(2);
    for (const days of [0, 91, "x"]) expect((await parent.call(progress, { path: `/api/me/children/x/progress?days=${days}`, params: { id: child.id } })).status).toBe(422);
  });

  it("only shows a parent their own children", async () => {
    const { child, kid } = await family();
    await createUser({ email: "stranger@example.test" });
    const stranger = await signedIn("stranger@example.test");
    expect((await progressOf(stranger, child.id)).status).toBe(404);
    expect((await stranger.call(report, { path: "/api/me/children/x/report", params: { id: child.id } })).status).toBe(404);
    expect((await stranger.call(readControls, { path: "/api/me/children/x/controls", params: { id: child.id } })).status).toBe(404);
    expect((await stranger.call(overview, { path: "/api/me/children/overview" })).body).toEqual([]);
    expect((await progressOf(kid, child.id)).status).toBe(403);
    expect((await kid.call(overview, { path: "/api/me/children/overview" })).status).toBe(403);
  });

  it("downloads a learning report as a PDF, named without the child's name", async () => {
    const { parent, child } = await family();
    const response = await parent.call(report, { path: "/api/me/children/x/report?days=30", params: { id: child.id } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="lumina-learning-report-\d{4}-\d{2}-\d{2}-30-days\.pdf"$/);
    expect(response.headers.get("content-disposition")).not.toMatch(/leo/i);
    const bytes = new TextEncoder().encode(response.body as string);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const inline = await parent.call(report, { path: "/api/me/children/x/report?days=7&inline=1", params: { id: child.id } });
    expect(inline.headers.get("content-disposition")).toMatch(/^inline; filename=".*-7-days\.pdf"$/);
    expect((await parent.call(report, { path: "/api/me/children/x/report?days=12", params: { id: child.id } })).status).toBe(422);
  });

  it("puts a long report on several pages", async () => {
    const { parent, child } = await family();
    const maths = await getDb().subject.findUniqueOrThrow({ where: { slug: "mathematics" } });
    // Forty courses started: the courses table continues on the next pages.
    for (let index = 0; index < 40; index++) {
      const extra = await getDb().course.create({ data: { slug: `extra-${index}`, title: `Extra course number ${index + 1} with a long title to wrap`, summary: "x", gradeLevel: 4, subjectId: maths.id, status: "published", lessons: { create: [{ slug: "one", title: "One", summary: "x", position: 1 }] } } });
      await getDb().enrollment.create({ data: { studentId: child.id, courseId: extra.id } });
    }
    const { childProgress } = await import("@/server/family/progress");
    const { childReportPdf } = await import("@/server/family/report-pdf");
    const parentUser = await getDb().user.findUniqueOrThrow({ where: { email: "mum@example.test" } });
    const data = await childProgress({ user: parentUser } as never, child.id, { days: 90 });
    const pdf = await PDFDocument.load(await childReportPdf(data));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
    expect(pdf.getTitle()).toBe("Learning report: Leo");
    expect((await parent.call(report, { path: "/api/me/children/x/report?days=90", params: { id: child.id } })).status).toBe(200);
  });

  it("sets parental controls, which the child's app reads with today's minutes", async () => {
    const { parent, kid, child } = await family();
    const path = "/api/me/children/x/controls";
    expect((await parent.call(readControls, { path, params: { id: child.id } })).body).toEqual({
      daily_minutes: null,
      bedtime: null,
      when_reached: "remind",
      updated_at: null,
      updated_by: null,
    });

    const saved = await parent.call(writeControls, {
      method: "PUT",
      path,
      params: { id: child.id },
      body: { daily_minutes: 30, bedtime: { start: "20:00", end: "07:00" }, when_reached: "pause" },
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ daily_minutes: 30, bedtime: { start: "20:00", end: "07:00" }, when_reached: "pause", updated_by: "you" });

    // The child's app: the same settings, and the 15 minutes learned today.
    expect((await kid.call(studentControls, { path: "/api/learn/controls" })).body).toEqual({
      daily_minutes: 30,
      bedtime: { start: "20:00", end: "07:00" },
      when_reached: "pause",
      minutes_today: 15,
    });
    // Shown on the dashboard card and the child's page too.
    expect((await parent.call(overview, { path: "/api/me/children/overview" })).body[0].controls).toMatchObject({ daily_minutes: 30, when_reached: "pause" });

    // Another guardian sees who changed them.
    const dad = await createUser({ email: "dad@example.test", displayName: "Sam Parent" });
    await linkChild(dad, child);
    expect((await (await signedIn("dad@example.test")).call(readControls, { path, params: { id: child.id } })).body.updated_by).toBe("Pat Parent");

    // Turning everything off.
    const off = await parent.call(writeControls, { method: "PUT", path, params: { id: child.id }, body: { daily_minutes: null, bedtime: null, when_reached: "remind" } });
    expect(off.body).toMatchObject({ daily_minutes: null, bedtime: null });
  });

  it("refuses controls that don't make sense, and says which field", async () => {
    const { parent, child } = await family();
    const put = (body: unknown) => parent.call(writeControls, { method: "PUT", path: "/api/me/children/x/controls", params: { id: child.id }, body });
    const cases: Array<[unknown, string]> = [
      [{ daily_minutes: 17, bedtime: null, when_reached: "remind" }, "body.daily_minutes"],
      [{ daily_minutes: null, bedtime: { start: "20:00", end: "20:00" }, when_reached: "remind" }, "body.bedtime.end"],
      [{ daily_minutes: null, bedtime: { start: "8pm", end: "07:00" }, when_reached: "remind" }, "body.bedtime.start"],
      [{ daily_minutes: null, bedtime: null, when_reached: "lock" }, "body.when_reached"],
    ];
    for (const [body, field] of cases) {
      const response = await put(body);
      expect(response.status, field).toBe(422);
      expect(response.body.error.details[0].field).toBe(field);
    }
  });

  it("includes the controls in the data copy, and deletes them with the child", async () => {
    const { parent, child } = await family();
    await parent.call(writeControls, { method: "PUT", path: "/api/me/children/x/controls", params: { id: child.id }, body: { daily_minutes: 45, bedtime: null, when_reached: "remind" } });
    const copy = await parent.call(childData, { path: "/api/me/children/x/data", params: { id: child.id } });
    expect(copy.body.learning.controls).toEqual({ daily_minutes: 45, bedtime_start: null, bedtime_end: null, when_reached: "remind", updated_at: expect.any(String) });
    expect((await parent.call(deleteChild, { method: "DELETE", path: "/api/me/children/x", params: { id: child.id } })).status).toBe(204);
    expect(await getDb().parentalControls.count({ where: { childId: child.id } })).toBe(0);
  });
});
