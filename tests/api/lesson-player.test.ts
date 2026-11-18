import { describe, expect, it } from "vitest";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { GET as badges } from "@/app/api/learn/badges/route";
import { GET as certificatePdf } from "@/app/api/learn/certificates/[certificateId]/pdf/route";
import { GET as certificate } from "@/app/api/learn/certificates/[certificateId]/route";
import { GET as certificates } from "@/app/api/learn/certificates/route";
import { POST as enroll } from "@/app/api/learn/enrollments/route";
import { DELETE as unenroll } from "@/app/api/learn/enrollments/[courseId]/route";
import { PUT as reportLesson } from "@/app/api/learn/lessons/[lessonId]/progress/route";
import { GET as lessonView } from "@/app/api/learn/lessons/[lessonId]/route";
import { GET as summary } from "@/app/api/learn/summary/route";
import { getDb } from "@/server/db";
import { certificateCode, findLessonId } from "@/server/learning/service";
import { Browser } from "../support/browser";
import { createCatalog, createUser, PASSWORD } from "../support/factories";

async function student(username = "kid1", overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser({ role: "student", username, displayName: "Maya Lopez", ...overrides });
  const browser = new Browser();
  expect((await browser.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username, password: PASSWORD } })).status).toBe(200);
  return { user, browser };
}

const course = (slug: string) => getDb().course.findUniqueOrThrow({ where: { slug }, include: { lessons: { orderBy: { position: "asc" } } } });
const view = (browser: Browser, lessonId: string) => browser.call(lessonView, { path: "/api/learn/lessons/x", params: { lessonId } });
const report = (browser: Browser, lessonId: string, body: unknown) => browser.call(reportLesson, { method: "PUT", path: "/api/learn/lessons/x/progress", params: { lessonId }, body });
const start = (browser: Browser, courseId: string) => browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: courseId } });

const VIDEO = {
  id: "video",
  type: "video",
  title: "Halves",
  hls: "/media/x/master.m3u8",
  mp4: "/media/x/video.mp4",
  duration_seconds: 24,
  captions: [{ src: "/media/x/en.vtt", lang: "en", label: "English" }],
};

describe("lesson player API: the lesson", () => {
  it("shows the outline and neighbours, and the content only once the course is started", async () => {
    await createCatalog();
    const fractions = await course("fractions");
    await getDb().lesson.update({
      where: { id: fractions.lessons[0]!.id },
      data: {
        content: [
          { id: "intro", type: "text", paragraphs: ["A fraction is a part of a whole."] },
          VIDEO,
          { id: "bad", type: "image", src: "javascript:alert(1)", alt: "x", width: 10, height: 10 }, // never rendered
          { id: "embed", type: "embed", url: "https://evil.example/player", title: "Not allowed" }, // not on the allow-list
        ],
      },
    });
    const { browser } = await student();

    const before = await view(browser, fractions.lessons[0]!.id);
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({ enrolled: false, blocks: [], previous: null, next: { slug: "equivalent-fractions" } });
    expect(before.body.outline.map((lesson: { slug: string }) => lesson.slug)).toEqual(["what-is-a-fraction", "equivalent-fractions"]);

    await start(browser, fractions.id);
    const after = await view(browser, fractions.lessons[0]!.id);
    expect(after.body.enrolled).toBe(true);
    expect(after.body.blocks.map((block: { id: string }) => block.id)).toEqual(["intro", "video"]); // unsafe blocks left out
    expect(after.body.course).toMatchObject({ slug: "fractions", grade_level: 4, subject: { slug: "mathematics" } });
    expect(await findLessonId("fractions", "equivalent-fractions")).toBe(fractions.lessons[1]!.id);
    expect(await findLessonId("fractions", "nope")).toBeNull();
  });

  it("hides draft courses' lessons and is for students only", async () => {
    await createCatalog();
    const draft = await course("secret-draft");
    const { browser } = await student();
    expect((await view(browser, draft.lessons[0]!.id)).status).toBe(404);
    expect((await view(browser, crypto.randomUUID())).status).toBe(404);
    expect((await new Browser().call(lessonView, { path: "/api/learn/lessons/x", params: { lessonId: draft.lessons[0]!.id } })).status).toBe(401);
  });
});

describe("lesson player API: progress sync", () => {
  it("remembers where each video was left, merging reports", async () => {
    await createCatalog();
    const fractions = await course("fractions");
    const lessonId = fractions.lessons[0]!.id;
    const { browser } = await student();
    await start(browser, fractions.id);
    await report(browser, lessonId, { status: "started", media: { video: 12.5 } });
    const second = await report(browser, lessonId, { status: "started", media: { other: 3 } });
    expect(second.body.media_positions).toEqual({ video: 12.5, other: 3 });
    await report(browser, lessonId, { status: "started", media: { video: 20 } });
    expect((await view(browser, lessonId)).body.progress).toMatchObject({ status: "started", media_positions: { video: 20, other: 3 } });
    expect((await report(browser, lessonId, { status: "started", media: { "Bad Id!": 3 } })).status).toBe(422);
  });

  it("applies a report once: a retry with the same report_id changes nothing", async () => {
    await createCatalog();
    const fractions = await course("fractions");
    const lessonId = fractions.lessons[0]!.id;
    const { user, browser } = await student();
    await start(browser, fractions.id);
    const reportId = crypto.randomUUID();
    const first = await report(browser, lessonId, { status: "completed", seconds: 60, report_id: reportId });
    expect(first.body).toMatchObject({ duplicate: false, seconds_spent: 60, status: "completed" });
    const retry = await report(browser, lessonId, { status: "completed", seconds: 60, report_id: reportId });
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ duplicate: true, seconds_spent: 60, new_badges: [] });
    const day = await getDb().learningDay.findFirstOrThrow({ where: { studentId: user.id } });
    expect(day.secondsSpent).toBe(60);
    // Another report (new id) adds up as usual.
    expect((await report(browser, lessonId, { status: "started", seconds: 5, report_id: crypto.randomUUID() })).body.seconds_spent).toBe(65);
    expect((await report(browser, lessonId, { status: "started", report_id: "not-a-uuid" })).status).toBe(422);
  });
});

describe("gamification API", () => {
  it("awards badges when earned (once), reports level-ups, and shows the whole shelf", async () => {
    await createCatalog();
    const counting = await course("counting"); // one lesson: finishing it finishes the course
    const { browser } = await student();
    await start(browser, counting.id);
    const done = await report(browser, counting.lessons[0]!.id, { status: "completed" });
    expect(done.body.new_badges.map((badge: { id: string }) => badge.id)).toEqual(["first-lesson", "first-course"]);
    expect(done.body.level).toEqual({ before: 1, after: 1 }); // 10 + 50 XP: still level 1 (100 needed)
    expect((await report(browser, counting.lessons[0]!.id, { status: "completed" })).body.new_badges).toEqual([]);

    const shelf = await browser.call(badges, { path: "/api/learn/badges" });
    expect(shelf.body.length).toBeGreaterThanOrEqual(9);
    const earned = shelf.body.filter((badge: { earned_at: string | null }) => badge.earned_at).map((badge: { id: string }) => badge.id);
    expect(earned).toEqual(["first-lesson", "first-course"]);
    const totals = await browser.call(summary, { path: "/api/learn/summary" });
    expect(totals.body).toMatchObject({ badges_earned: 2, certificates: 1, courses_completed: 1, xp: 60 });
  });

  it("reports a level-up", async () => {
    await createCatalog();
    const fractions = await course("fractions");
    const { user, browser } = await student();
    await start(browser, fractions.id);
    // 9 lessons done elsewhere (90 XP): the next one reaches 100 XP, level 2.
    const maths = await getDb().subject.findFirstOrThrow();
    const other = await getDb().course.create({
      data: { slug: "drill", title: "Drill", summary: "Practice.", gradeLevel: 4, subjectId: maths.id, status: "published", lessons: { create: Array.from({ length: 9 }, (_, i) => ({ slug: `d${i}`, title: `D${i}`, summary: "x", position: i + 1 })) } },
      include: { lessons: true },
    });
    await getDb().lessonProgress.createMany({ data: other.lessons.map((lesson) => ({ studentId: user.id, lessonId: lesson.id, status: "completed" as const, completedAt: new Date() })) });
    const result = await report(browser, fractions.lessons[0]!.id, { status: "completed" });
    expect(result.body.level).toEqual({ before: 1, after: 2 });
    expect(result.body.new_badges.map((badge: { id: string }) => badge.id)).toContain("ten-lessons");
  });
});

describe("certificates API", () => {
  it("issues a certificate when the last lesson is done, lists it, and keeps it after leaving the course", async () => {
    await createCatalog();
    const fractions = await course("fractions");
    const { browser } = await student();
    await start(browser, fractions.id);
    expect((await report(browser, fractions.lessons[0]!.id, { status: "completed" })).body.certificate).toBeNull();
    const last = await report(browser, fractions.lessons[1]!.id, { status: "completed" });
    expect(last.body.course_completed).toBe(true);
    expect(last.body.certificate).toMatchObject({
      student_name: "Maya Lopez",
      course_title: "Fractions Made Simple",
      subject_name: "Mathematics",
      grade_level: 4,
      lessons_count: 2,
      course_slug: "fractions",
    });
    expect(last.body.certificate.code).toMatch(/^LUM-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);

    const list = await browser.call(certificates, { path: "/api/learn/certificates" });
    expect(list.body).toHaveLength(1);
    const one = await browser.call(certificate, { path: "/api/learn/certificates/x", params: { certificateId: list.body[0].id } });
    expect(one.body.code).toBe(last.body.certificate.code);

    // Leaving and coming back: still one certificate, and the course still counts as finished.
    await browser.call(unenroll, { method: "DELETE", path: "/api/learn/enrollments/x", params: { courseId: fractions.id } });
    expect((await browser.call(certificates, { path: "/api/learn/certificates" })).body).toHaveLength(1);
    const back = await start(browser, fractions.id);
    expect(back.body.completed_at).toBeTruthy();
  });

  it("downloads a real PDF, named after the course (not the child)", async () => {
    await createCatalog();
    const counting = await course("counting");
    const { browser } = await student();
    await start(browser, counting.id);
    const done = await report(browser, counting.lessons[0]!.id, { status: "completed" });
    const pdf = await browser.call(certificatePdf, { path: `/api/learn/certificates/x/pdf`, params: { certificateId: done.body.certificate.id } });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toBe('attachment; filename="lumina-certificate-counting-to-100.pdf"');
    expect(String(pdf.body).startsWith("%PDF-")).toBe(true);
    const inline = await browser.call(certificatePdf, { path: `/api/learn/certificates/x/pdf?inline=1`, params: { certificateId: done.body.certificate.id } });
    expect(inline.headers.get("content-disposition")).toMatch(/^inline;/);
  });

  it("keeps each student's certificates their own", async () => {
    await createCatalog();
    const counting = await course("counting");
    const maya = await student("maya1");
    const leo = await student("leo1", { displayName: "Leo" });
    await start(maya.browser, counting.id);
    const done = await report(maya.browser, counting.lessons[0]!.id, { status: "completed" });
    const id = done.body.certificate.id;
    expect((await leo.browser.call(certificate, { path: "/api/learn/certificates/x", params: { certificateId: id } })).status).toBe(404);
    expect((await leo.browser.call(certificatePdf, { path: "/api/learn/certificates/x/pdf", params: { certificateId: id } })).status).toBe(404);
    expect((await leo.browser.call(certificates, { path: "/api/learn/certificates" })).body).toEqual([]);
  });

  it("makes readable, unique-looking codes", () => {
    const codes = new Set(Array.from({ length: 200 }, certificateCode));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code.slice(4)).not.toMatch(/[01ILO]/);
  });
});
