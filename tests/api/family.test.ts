import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { PUT as activeChild } from "@/app/api/me/active-child/route";
import { GET as childData } from "@/app/api/me/children/[id]/data/route";
import { DELETE as deleteChild } from "@/app/api/me/children/[id]/route";
import { PUT as setUpSignIn } from "@/app/api/me/children/[id]/sign-in/route";
import { POST as linkChild } from "@/app/api/me/children/link/route";
import { GET as listChildren, POST as addChild } from "@/app/api/me/children/route";
import { POST as linkCode } from "@/app/api/me/link-code/route";
import { GET as me } from "@/app/api/me/route";
import { getDb } from "@/server/db";
import { Browser } from "../support/browser";
import { createClass, createUser, linkChild as linkChildRow, PASSWORD } from "../support/factories";

async function signedIn(email: string) {
  const browser = new Browser();
  expect((await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password: PASSWORD } })).status).toBe(200);
  return browser;
}

describe("families", () => {
  it("adds a child (with consent), sets up sign-in, and the child can sign in", async () => {
    await createUser({ email: "mum@example.test" });
    const parent = await signedIn("mum@example.test");
    const noConsent = await parent.call(addChild, { method: "POST", path: "/api/me/children", body: { display_name: "Ana", grade_level: 2 } });
    expect(noConsent.status).toBe(422);
    expect(noConsent.body.error.details[0].field).toBe("body.parental_consent");

    const added = await parent.call(addChild, { method: "POST", path: "/api/me/children", body: { display_name: "Ana", grade_level: 2, parental_consent: true } });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ display_name: "Ana", grade_level: 2, username: null, sign_in_method: null });
    expect((await parent.call(me, { path: "/api/me" })).body.active_child_id).toBe(added.body.id);

    const pictures = await parent.call(setUpSignIn, {
      method: "PUT",
      path: "/api/me/children/x/sign-in",
      params: { id: added.body.id },
      body: { method: "pictures", username: "Ana2", pictures: ["cat", "cat", "sun"] },
    });
    expect(pictures.status).toBe(422);
    expect(pictures.body.error.details[0].field).toBe("body.pictures");

    const withPassword = await parent.call(setUpSignIn, {
      method: "PUT",
      path: "/api/me/children/x/sign-in",
      params: { id: added.body.id },
      body: { method: "password", username: "Ana2", password: "ana's password" },
    });
    expect(withPassword.status).toBe(200);
    expect(withPassword.body).toMatchObject({ username: "ana2", sign_in_method: "password" });

    const child = await new Browser().call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username: "ana2", password: "ana's password" } });
    expect(child.status).toBe(200);
    expect(child.body.user).toMatchObject({ role: "student", grade_level: 2 });
  });

  it("refuses a username someone else has", async () => {
    await createUser({ role: "student", username: "taken1" });
    await createUser({ email: "dad@example.test" });
    const parent = await signedIn("dad@example.test");
    const { body: kid } = await parent.call(addChild, { method: "POST", path: "/api/me/children", body: { display_name: "Bo", grade_level: 5, parental_consent: true } });
    const clash = await parent.call(setUpSignIn, {
      method: "PUT",
      path: "/api/me/children/x/sign-in",
      params: { id: kid.id },
      body: { method: "password", username: "taken1", password: "bo's password" },
    });
    expect(clash.status).toBe(409);
    expect(clash.body.error.details[0].field).toBe("body.username");
  });

  it("only manages the parent's own children", async () => {
    const stranger = await createUser({ role: "student" });
    await createUser({ email: "nosy@example.test" });
    const parent = await signedIn("nosy@example.test");
    const response = await parent.call(setUpSignIn, {
      method: "PUT",
      path: "/api/me/children/x/sign-in",
      params: { id: stranger.id },
      body: { method: "password", username: "stolen", password: "some password" },
    });
    expect(response.status).toBe(404);
    expect((await parent.call(activeChild, { method: "PUT", path: "/api/me/active-child", body: { child_id: stranger.id } })).status).toBe(404);
  });

  it("links a student account with the code the student made (once)", async () => {
    await createUser({ role: "student", username: "kid9", displayName: "Kid" });
    await createUser({ email: "parent@example.test" });
    const student = new Browser();
    await student.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username: "kid9", password: PASSWORD } });
    const code = await student.call(linkCode, { method: "POST", path: "/api/me/link-code" });
    expect(code.status).toBe(201);
    expect(code.body.code).toMatch(/^[A-Z2-9]{8}$/);

    const parent = await signedIn("parent@example.test");
    const linked = await parent.call(linkChild, { method: "POST", path: "/api/me/children/link", body: { code: ` ${code.body.code.toLowerCase()} ` } });
    expect(linked.status).toBe(200);
    expect(linked.body.display_name).toBe("Kid");
    expect((await parent.call(listChildren, { path: "/api/me/children" })).body).toHaveLength(1);
    const reused = await parent.call(linkChild, { method: "POST", path: "/api/me/children/link", body: { code: code.body.code } });
    expect(reused.status).toBe(400);
    expect(reused.body.error.details[0].field).toBe("body.code");
  });

  it("gives a parent a copy of a child's data, and deletes the child's account (FE-PUB-11)", async () => {
    const parentUser = await createUser({ email: "mum@example.test" });
    const teacher = await createUser({ role: "teacher", email: "sir@example.test" });
    const child = await createUser({ role: "student", username: "maya7", displayName: "Maya", gradeLevel: 3, pictures: ["cat", "sun", "tree"], password: null });
    await linkChildRow(parentUser, child);
    await createClass(teacher, [child], "DATA42");
    // Some learning to include in the copy.
    const maths = await getDb().subject.create({ data: { slug: "maths", name: "Maths" } });
    const course = await getDb().course.create({
      data: { slug: "shapes", title: "Shapes", summary: "Sides and corners.", gradeLevel: 3, subjectId: maths.id, status: "published", lessons: { create: [{ slug: "squares", title: "Squares", summary: "Four sides.", position: 1 }] } },
      include: { lessons: true },
    });
    await getDb().enrollment.create({ data: { studentId: child.id, courseId: course.id } });
    await getDb().lessonProgress.create({ data: { studentId: child.id, lessonId: course.lessons[0]!.id, status: "completed", completedAt: new Date(), secondsSpent: 300 } });
    await getDb().learningDay.create({ data: { studentId: child.id, day: new Date("2026-03-02T00:00:00Z"), secondsSpent: 300, lessonsCompleted: 1 } });
    await getDb().studentBadge.create({ data: { studentId: child.id, badge: "first-lesson" } });
    await getDb().lessonNote.create({ data: { studentId: child.id, lessonId: course.lessons[0]!.id, body: "Squares have 4 equal sides" } });
    await getDb().lessonBookmark.create({ data: { studentId: child.id, lessonId: course.lessons[0]!.id, anchor: "lesson" } });
    await getDb().reviewItem.create({ data: { studentId: child.id, lessonId: course.lessons[0]!.id, blockId: "check", box: 2, reps: 3, lapses: 1, dueAt: new Date("2026-03-09T00:00:00Z") } });
    await getDb().certificate.create({
      data: { studentId: child.id, courseId: course.id, code: "LUM-TEST-0001", studentName: "Maya", courseTitle: "Shapes", subjectName: "Maths", gradeLevel: 3, lessonsCount: 1 },
    });
    const parent = await signedIn("mum@example.test");

    const copy = await parent.call(childData, { path: "/api/me/children/x/data", params: { id: child.id } });
    expect(copy.status).toBe(200);
    expect(copy.headers.get("content-disposition")).toMatch(/^attachment; filename="lumina-child-data-[\d-]+\.json"$/);
    expect(copy.body.child).toMatchObject({ display_name: "Maya", grade_level: 3, username: "maya7", sign_in_method: "pictures" });
    expect(copy.body.guardians).toHaveLength(1);
    expect(copy.body.guardians[0].display_name).toBe(parentUser.displayName);
    expect(copy.body.classes).toEqual([{ name: "Class 1T", joined_at: expect.any(String) }]);
    expect(copy.body.learning.courses).toEqual([{ course: "Shapes", enrolled_at: expect.any(String), completed_at: null }]);
    expect(copy.body.learning.lessons).toEqual([expect.objectContaining({ course: "Shapes", lesson: "Squares", status: "completed", seconds_spent: 300 })]);
    expect(copy.body.learning.days).toEqual([{ day: "2026-03-02", seconds_spent: 300, lessons_completed: 1 }]);
    expect(copy.body.learning.badges).toEqual([{ badge: "first-lesson", earned_at: expect.any(String) }]);
    expect(copy.body.learning.notes).toEqual([expect.objectContaining({ course: "Shapes", lesson: "Squares", about: null, text: "Squares have 4 equal sides" })]);
    expect(copy.body.learning.bookmarks).toEqual([expect.objectContaining({ lesson: "Squares", about: null, video_seconds: null })]);
    expect(copy.body.learning.review).toEqual([{ course: "Shapes", lesson: "Squares", question: "check", box: 2, reviews: 3, misses: 1, due_at: "2026-03-09T00:00:00.000Z" }]);
    expect(copy.body.learning.certificates).toEqual([{ code: "LUM-TEST-0001", course: "Shapes", student_name: "Maya", issued_at: expect.any(String) }]);

    const removed = await parent.call(deleteChild, { method: "DELETE", path: "/api/me/children/x", params: { id: child.id } });
    expect(removed.status).toBe(204);
    expect((await parent.call(listChildren, { path: "/api/me/children" })).body).toHaveLength(0);
    expect(await getDb().user.findUnique({ where: { id: child.id } })).toBeNull();
    expect(await getDb().classMember.count({ where: { studentId: child.id } })).toBe(0);
    // Their learning goes with the account.
    expect(await getDb().enrollment.count({ where: { studentId: child.id } })).toBe(0);
    expect(await getDb().lessonProgress.count({ where: { studentId: child.id } })).toBe(0);
    expect(await getDb().learningDay.count({ where: { studentId: child.id } })).toBe(0);
    expect(await getDb().certificate.count({ where: { studentId: child.id } })).toBe(0);
    expect(await getDb().studentBadge.count({ where: { studentId: child.id } })).toBe(0);
    expect(await getDb().reviewItem.count({ where: { studentId: child.id } })).toBe(0);
    expect(await getDb().lessonNote.count({ where: { studentId: child.id } })).toBe(0);
    expect(await getDb().lessonBookmark.count({ where: { studentId: child.id } })).toBe(0);

    // Recorded without the child's name (children's data stays out of the security log).
    const events = await getDb().auditEvent.findMany({ where: { action: "family.child_deleted" } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: parentUser.id, data: { child_id: child.id, guardians: 1 } });
    expect(JSON.stringify(events[0]!.data)).not.toContain("Maya");

    // Gone means gone: the data copy now answers 404.
    expect((await parent.call(childData, { path: "/api/me/children/x/data", params: { id: child.id } })).status).toBe(404);
  });

  it("only lets a child's own guardians download or delete (FE-PUB-11)", async () => {
    const child = await createUser({ role: "student", username: "kid3", displayName: "Kid" });
    const parentUser = await createUser({ email: "mum@example.test" });
    await linkChildRow(parentUser, child);
    await createUser({ email: "stranger@example.test" });
    const stranger = await signedIn("stranger@example.test");
    expect((await stranger.call(childData, { path: "/api/me/children/x/data", params: { id: child.id } })).status).toBe(404);
    expect((await stranger.call(deleteChild, { method: "DELETE", path: "/api/me/children/x", params: { id: child.id } })).status).toBe(404);
    expect(await getDb().user.findUnique({ where: { id: child.id } })).not.toBeNull();
  });

  it("keeps family endpoints for parents", async () => {
    await createUser({ role: "teacher", email: "teacher@example.test" });
    const teacher = await signedIn("teacher@example.test");
    expect((await teacher.call(listChildren, { path: "/api/me/children" })).status).toBe(403);
    expect((await teacher.call(linkCode, { method: "POST", path: "/api/me/link-code" })).status).toBe(403);
  });
});
