import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as impersonate } from "@/app/api/admin/users/[id]/impersonate/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { DELETE as removeAnnouncement } from "@/app/api/me/announcements/[id]/route";
import { POST as readAnnouncement } from "@/app/api/me/announcements/[id]/read/route";
import { GET as announcements, POST as postAnnouncement } from "@/app/api/me/announcements/route";
import { GET as childData } from "@/app/api/me/children/[id]/data/route";
import { DELETE as deleteChild } from "@/app/api/me/children/[id]/route";
import { GET as contacts } from "@/app/api/me/contacts/route";
import { POST as sendMessage } from "@/app/api/me/conversations/[id]/messages/route";
import { POST as shareProgress } from "@/app/api/me/conversations/[id]/progress/route";
import { POST as markRead } from "@/app/api/me/conversations/[id]/read/route";
import { GET as conversation } from "@/app/api/me/conversations/[id]/route";
import { GET as conversations, POST as openConversation } from "@/app/api/me/conversations/route";
import { GET as events } from "@/app/api/me/events/route";
import { GET as unread } from "@/app/api/me/unread/route";
import { getDb } from "@/server/db";
import { realtimeHub } from "@/server/realtime/hub";
import { Browser, ORIGIN } from "../support/browser";
import { createCatalog, createClass, createUser, linkChild, PASSWORD } from "../support/factories";

const DAY = 86_400_000;

async function signedIn(email: string) {
  const browser = new Browser();
  expect((await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password: PASSWORD } })).status).toBe(200);
  return browser;
}

async function teacherUser(email: string, name: string, verified = true) {
  const user = await createUser({ role: "teacher", email, displayName: name });
  if (verified) await getDb().teacherProfile.update({ where: { userId: user.id }, data: { verifiedAt: new Date() } });
  return user;
}

/**
 * Mr Tom teaches Leo (Class 5L, with Mia, who has no parent on Lumina). Leo has two parents, Pat and Sam.
 * Another family (Ann, with Ben in Class 2B, taught by Ms Ivy) shouldn't see any of it.
 */
async function school() {
  await createCatalog();
  const tom = await teacherUser("tom@example.test", "Tom Teacher");
  const ivy = await teacherUser("ivy@example.test", "Ivy Teacher");
  const pat = await createUser({ email: "pat@example.test", displayName: "Pat Park" });
  const sam = await createUser({ email: "sam@example.test", displayName: "Sam Park" });
  const ann = await createUser({ email: "ann@example.test", displayName: "Ann Other" });
  const leo = await createUser({ role: "student", username: "leo", displayName: "Leo", gradeLevel: 5 });
  const mia = await createUser({ role: "student", username: "mia", displayName: "Mia", gradeLevel: 5 });
  const ben = await createUser({ role: "student", username: "ben", displayName: "Ben", gradeLevel: 2 });
  await linkChild(pat, leo);
  await linkChild(sam, leo);
  await linkChild(ann, ben);
  const class5 = await createClass(tom, [leo, mia], "CLASS5");
  const class2 = await createClass(ivy, [ben], "CLASS2");
  await getDb().class.update({ where: { id: class5.id }, data: { name: "Class 5L" } });
  await getDb().class.update({ where: { id: class2.id }, data: { name: "Class 2B" } });
  return { tom, ivy, pat, sam, ann, leo, mia, ben, class5, class2 };
}

const open = (browser: Browser, body: unknown) => browser.call(openConversation, { method: "POST", path: "/api/me/conversations", body });
const view = (browser: Browser, id: string, query = "") => browser.call(conversation, { path: `/api/me/conversations/x${query}`, params: { id } });
const send = (browser: Browser, id: string, body: string) => browser.call(sendMessage, { method: "POST", path: "/api/me/conversations/x/messages", params: { id }, body: { body } });
const unreadOf = async (browser: Browser) => (await browser.call(unread, { path: "/api/me/unread" })).body;

/** Opens the live stream as `browser` and reads events as they come. */
async function liveStream(browser: Browser) {
  const controller = new AbortController();
  const request = new NextRequest(new URL("/api/me/events", ORIGIN), {
    headers: { cookie: [...browser.cookies].map(([name, value]) => `${name}=${value}`).join("; "), accept: "text/event-stream" },
    signal: controller.signal,
  });
  const response = await events(request, { params: Promise.resolve({}) });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  /** The next event (name and data), or null after `ms` without one. Comments (": ping") are skipped. */
  const next = async (ms = 3000): Promise<{ event: string; data: Record<string, unknown> } | null> => {
    const deadline = Date.now() + ms;
    while (true) {
      const end = buffer.indexOf("\n\n");
      if (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (event) return { event, data: data ? JSON.parse(data) : {} };
        continue;
      }
      const left = deadline - Date.now();
      if (left <= 0) return null;
      const chunk = await Promise.race([reader.read(), new Promise<null>((resolve) => setTimeout(() => resolve(null), left))]);
      if (!chunk) return null;
      if (chunk.done) return null;
      buffer += decoder.decode(chunk.value, { stream: true });
    }
  };
  return { next, close: () => controller.abort() };
}

describe("messages between parents and teachers", () => {
  it("lists who each side can write to", async () => {
    const { leo, tom } = await school();
    const pat = await signedIn("pat@example.test");
    expect((await pat.call(contacts, { path: "/api/me/contacts" })).body).toEqual({
      classes: [],
      children: [{ id: leo.id, name: "Leo", teachers: [{ id: tom.id, name: "Tom Teacher", classes: ["Class 5L"] }] }],
    });
    const teacher = await signedIn("tom@example.test");
    const list = (await teacher.call(contacts, { path: "/api/me/contacts" })).body;
    expect(list.classes).toEqual([expect.objectContaining({ name: "Class 5L", students: [{ id: leo.id, name: "Leo", parents: 2 }, expect.objectContaining({ name: "Mia", parents: 0 })] })]);
  });

  it("lets a parent and the teacher talk about a child, with unread counts and read state", async () => {
    const { leo, tom } = await school();
    const pat = await signedIn("pat@example.test");
    const teacher = await signedIn("tom@example.test");
    const sam = await signedIn("sam@example.test");

    const opened = await open(pat, { child_id: leo.id, teacher_id: tom.id });
    expect(opened.status).toBe(201);
    // The teacher opening it about Leo finds the same conversation.
    const same = await open(teacher, { child_id: leo.id });
    expect(same.status).toBe(200);
    expect(same.body.id).toBe(opened.body.id);
    const id = opened.body.id as string;

    const sent = await send(pat, id, "  Hello Mr Tom, how is Leo doing with fractions?  ");
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ kind: "text", body: "Hello Mr Tom, how is Leo doing with fractions?", mine: true, sender: { name: "Pat Park", role_label: "Leo's parent" } });
    expect(await unreadOf(teacher)).toEqual({ messages: 1, announcements: 0 });
    expect(await unreadOf(sam)).toEqual({ messages: 1, announcements: 0 }); // Leo's other parent is in the conversation too
    expect(await unreadOf(pat)).toEqual({ messages: 0, announcements: 0 });

    const inbox = (await teacher.call(conversations, { path: "/api/me/conversations" })).body;
    expect(inbox).toEqual([
      expect.objectContaining({ id, child: { id: leo.id, name: "Leo", grade_level: 5 }, teacher: { id: tom.id, name: "Tom Teacher" }, classes: ["Class 5L"], unread: 1, last_message: expect.objectContaining({ sender_name: "Pat Park", mine: false }) }),
    ]);

    const thread = (await view(teacher, id)).body;
    expect(thread.participants.map((person: { name: string; role_label: string }) => `${person.name} (${person.role_label})`)).toEqual([
      "Tom Teacher (Teacher)",
      "Pat Park (Leo's parent)",
      "Sam Park (Leo's parent)",
    ]);
    expect(thread.messages).toEqual([expect.objectContaining({ body: "Hello Mr Tom, how is Leo doing with fractions?", mine: false })]);
    expect(thread.can_send).toBe(true);
    expect((await teacher.call(markRead, { method: "POST", path: "/api/me/conversations/x/read", params: { id } })).status).toBe(204);
    expect((await unreadOf(teacher)).messages).toBe(0);

    await send(teacher, id, "He's doing well! He finished the first lesson.");
    expect((await unreadOf(pat)).messages).toBe(1);
    expect((await view(pat, id)).body.messages.map((message: { body: string; mine: boolean }) => [message.body, message.mine])).toEqual([
      ["Hello Mr Tom, how is Leo doing with fractions?", true],
      ["He's doing well! He finished the first lesson.", false],
    ]);
  });

  it("shares progress updates: the teacher's work, the parent's learning at home", async () => {
    const { leo, tom, class5 } = await school();
    const fractions = await getDb().course.findUniqueOrThrow({ where: { slug: "fractions" }, include: { lessons: { orderBy: { position: "asc" } } } });
    await getDb().assignment.createMany({
      data: [
        { classId: class5.id, teacherId: tom.id, courseId: fractions.id, lessonId: fractions.lessons[0]!.id, title: "Halves homework", dueAt: new Date(Date.now() - 2 * DAY) },
        { classId: class5.id, teacherId: tom.id, courseId: fractions.id, title: "Finish Fractions", dueAt: new Date(Date.now() + 3 * DAY) },
      ],
    });
    await getDb().lessonProgress.create({ data: { studentId: leo.id, lessonId: fractions.lessons[1]!.id, status: "completed", completedAt: new Date() } });
    const teacher = await signedIn("tom@example.test");
    const pat = await signedIn("pat@example.test");
    const { id } = (await open(teacher, { child_id: leo.id })).body;

    // Both see the child's work set by this teacher next to the conversation.
    expect((await view(pat, id)).body.context.work).toEqual([
      expect.objectContaining({ title: "Halves homework", status: "not_started" }),
      expect.objectContaining({ title: "Finish Fractions", status: "in_progress", lessons_done: 1, lessons_total: 2 }),
    ]);

    const update = await teacher.call(shareProgress, { method: "POST", path: "/api/me/conversations/x/progress", params: { id }, body: { note: "Here's where Leo is." } });
    expect(update.status).toBe(201);
    expect(update.body).toMatchObject({ kind: "progress", body: "Here's where Leo is.", snapshot: { title: "Work in Class 5L" } });
    expect(update.body.snapshot.items).toEqual([
      { label: "Halves homework", value: "Not started · Overdue by 2 days", tone: "attention" },
      { label: "Finish Fractions", value: expect.stringMatching(/^In progress \(1 of 2 lessons\) · Due in 3 days/), tone: "neutral" },
    ]);

    const home = await pat.call(shareProgress, { method: "POST", path: "/api/me/conversations/x/progress", params: { id }, body: {} });
    expect(home.body.snapshot.title).toBe("Learning at home");
    expect(home.body.snapshot.items.map((item: { label: string }) => item.label)).toEqual(
      expect.arrayContaining(["Time in lessons, last 7 days", "Days with learning, last 7 days", "Lessons finished, last 7 days", "Streak"]),
    );
    expect((await view(teacher, id)).body.messages.map((message: { kind: string }) => message.kind)).toEqual(["progress", "progress"]);
    expect((await teacher.call(conversations, { path: "/api/me/conversations" })).body[0].last_message.preview).toBe("Progress update");
  });

  it("keeps conversations to the people they're about", async () => {
    const { leo, ben, mia, tom, ivy } = await school();
    const pat = await signedIn("pat@example.test");
    const ann = await signedIn("ann@example.test");
    const teacher = await signedIn("tom@example.test");
    const otherTeacher = await signedIn("ivy@example.test");
    const { id } = (await open(pat, { child_id: leo.id, teacher_id: tom.id })).body;
    await send(pat, id, "Private note about Leo");

    expect((await view(ann, id)).status).toBe(404);
    expect((await send(ann, id, "hi")).status).toBe(404);
    expect((await view(otherTeacher, id)).status).toBe(404);
    expect((await ann.call(conversations, { path: "/api/me/conversations" })).body).toEqual([]);
    // Only a child's own teachers, only one's own children, only pupils with a parent.
    expect((await open(pat, { child_id: leo.id, teacher_id: ivy.id })).status).toBe(404);
    expect((await open(pat, { child_id: ben.id, teacher_id: ivy.id })).status).toBe(404);
    expect((await open(pat, { child_id: leo.id })).status).toBe(422);
    expect((await open(teacher, { child_id: ben.id })).status).toBe(404);
    expect((await open(teacher, { child_id: mia.id })).body.error.code).toBe("no_parent");

    // Unverified teachers and students aren't part of messaging.
    await teacherUser("new@example.test", "New Teacher", false);
    const unverified = await signedIn("new@example.test");
    expect((await unverified.call(conversations, { path: "/api/me/conversations" })).status).toBe(403);
    const kid = new Browser();
    await kid.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username: "leo", password: PASSWORD } });
    expect((await kid.call(conversations, { path: "/api/me/conversations" })).status).toBe(403);

    // When Leo leaves the class, the conversation closes for both sides.
    await getDb().classMember.deleteMany({ where: { studentId: leo.id } });
    expect((await view(pat, id)).status).toBe(404);
    expect((await teacher.call(conversations, { path: "/api/me/conversations" })).body).toEqual([]);
  });

  it("checks messages, pages through long conversations, and limits how fast people send", async () => {
    const { leo, tom } = await school();
    const pat = await signedIn("pat@example.test");
    const { id } = (await open(pat, { child_id: leo.id, teacher_id: tom.id })).body;
    expect((await send(pat, id, "   ")).status).toBe(422);
    expect((await send(pat, id, "x".repeat(2001))).body.error.details[0].field).toBe("body.body");

    const base = Date.now() - 60 * 60_000;
    await getDb().message.createMany({ data: Array.from({ length: 55 }, (_, index) => ({ conversationId: id, senderId: tom.id, body: `Message ${index + 1}`, createdAt: new Date(base + index * 1000) })) });
    const latest = (await view(pat, id)).body;
    expect(latest.messages).toHaveLength(50);
    expect(latest.has_more).toBe(true);
    expect(latest.messages[0].body).toBe("Message 6");
    expect(latest.messages.at(-1).body).toBe("Message 55");
    const older = (await view(pat, id, `?before=${encodeURIComponent(latest.messages[0].created_at)}`)).body;
    expect(older.messages.map((message: { body: string }) => message.body)).toEqual(["Message 1", "Message 2", "Message 3", "Message 4", "Message 5"]);
    expect(older.has_more).toBe(false);

    for (let index = 0; index < 30; index++) expect((await send(pat, id, `Quick ${index}`)).status).toBe(201);
    const limited = await send(pat, id, "One too many");
    expect(limited.status).toBe(429);
  });

  it("lets an admin viewing as a parent read, but not send", async () => {
    const { leo, tom, pat: patUser } = await school();
    const pat = await signedIn("pat@example.test");
    const { id } = (await open(pat, { child_id: leo.id, teacher_id: tom.id })).body;
    await createUser({ role: "admin", email: "admin@example.test" });
    const admin = await signedIn("admin@example.test");
    expect((await admin.call(impersonate, { method: "POST", path: "/api/admin/users/x/impersonate", params: { id: patUser.id } })).status).toBe(200);
    const thread = await view(admin, id);
    expect(thread.status).toBe(200);
    expect(thread.body.can_send).toBe(false);
    expect((await send(admin, id, "As support")).status).toBe(403);
  });
});

describe("class announcements", () => {
  it("reaches the parents of the class, who mark it read; the teacher sees how many read it", async () => {
    const { class5, class2 } = await school();
    const teacher = await signedIn("tom@example.test");
    const pat = await signedIn("pat@example.test");
    const sam = await signedIn("sam@example.test");
    const ann = await signedIn("ann@example.test");

    const posted = await teacher.call(postAnnouncement, { method: "POST", path: "/api/me/announcements", body: { class_id: class5.id, title: "Trip on Friday", body: "Bring a packed lunch." } });
    expect(posted.status).toBe(201);
    expect(posted.body).toMatchObject({ title: "Trip on Friday", class_name: "Class 5L", reach: { parents: 2, read: 0 } });
    expect((await teacher.call(postAnnouncement, { method: "POST", path: "/api/me/announcements", body: { class_id: class2.id, title: "Not mine", body: "x" } })).status).toBe(404);
    expect((await teacher.call(postAnnouncement, { method: "POST", path: "/api/me/announcements", body: { class_id: class5.id, title: " ", body: "x" } })).body.error.details[0].field).toBe("body.title");

    const inbox = (await pat.call(announcements, { path: "/api/me/announcements" })).body;
    expect(inbox).toEqual([expect.objectContaining({ title: "Trip on Friday", body: "Bring a packed lunch.", class_name: "Class 5L", teacher_name: "Tom Teacher", children: ["Leo"], read: false, reach: null })]);
    expect((await unreadOf(pat)).announcements).toBe(1);
    expect((await ann.call(announcements, { path: "/api/me/announcements" })).body).toEqual([]);
    expect((await ann.call(readAnnouncement, { method: "POST", path: "/api/me/announcements/x/read", params: { id: posted.body.id } })).status).toBe(404);

    expect((await pat.call(readAnnouncement, { method: "POST", path: "/api/me/announcements/x/read", params: { id: posted.body.id } })).status).toBe(204);
    expect((await unreadOf(pat)).announcements).toBe(0);
    expect((await unreadOf(sam)).announcements).toBe(1);
    expect((await teacher.call(announcements, { path: "/api/me/announcements" })).body[0].reach).toEqual({ parents: 2, read: 1 });

    expect((await pat.call(postAnnouncement, { method: "POST", path: "/api/me/announcements", body: { class_id: class5.id, title: "x", body: "y" } })).status).toBe(403);
    expect((await teacher.call(removeAnnouncement, { method: "DELETE", path: "/api/me/announcements/x", params: { id: posted.body.id } })).status).toBe(204);
    expect((await pat.call(announcements, { path: "/api/me/announcements" })).body).toEqual([]);
  });
});

describe("live updates", () => {
  it("tells the people in a conversation at once, and nobody else", async () => {
    const { leo, tom, class5 } = await school();
    const pat = await signedIn("pat@example.test");
    const ann = await signedIn("ann@example.test");
    const teacher = await signedIn("tom@example.test");
    const { id } = (await open(teacher, { child_id: leo.id })).body;

    const patLive = await liveStream(pat);
    const annLive = await liveStream(ann);
    expect(await patLive.next()).toEqual({ event: "ready", data: {} });
    expect(await annLive.next()).toEqual({ event: "ready", data: {} });

    await send(teacher, id, "Leo read aloud today!");
    expect(await patLive.next()).toEqual({ event: "message", data: { type: "message", conversation_id: id } });

    await teacher.call(postAnnouncement, { method: "POST", path: "/api/me/announcements", body: { class_id: class5.id, title: "Sports day", body: "Wear trainers." } });
    expect(await patLive.next()).toMatchObject({ event: "announcement", data: { type: "announcement" } });

    // Another family hears nothing about it.
    expect(await annLive.next(800)).toBeNull();

    patLive.close();
    annLive.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(realtimeHub().subscriberCount).toBe(0);
    void tom;
  });

  it("is only for parents and teachers", async () => {
    await school();
    const kid = new Browser();
    await kid.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username: "leo", password: PASSWORD } });
    const response = await events(new NextRequest(new URL("/api/me/events", ORIGIN), { headers: { cookie: [...kid.cookies].map(([name, value]) => `${name}=${value}`).join("; ") } }), { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
  });
});

describe("messages and the child's data", () => {
  it("includes them in the parent's data copy, and deletes them with the child", async () => {
    const { leo, tom } = await school();
    const pat = await signedIn("pat@example.test");
    const { id } = (await open(pat, { child_id: leo.id, teacher_id: tom.id })).body;
    await send(pat, id, "Hello!");
    const copy = (await pat.call(childData, { path: "/api/me/children/x/data", params: { id: leo.id } })).body;
    expect(copy.learning.messages).toEqual([{ teacher: "Tom Teacher", from: "Pat Park", kind: "text", text: "Hello!", sent_at: expect.any(String) }]);
    expect((await pat.call(deleteChild, { method: "DELETE", path: "/api/me/children/x", params: { id: leo.id } })).status).toBe(204);
    expect(await getDb().conversation.count()).toBe(0);
    expect(await getDb().message.count()).toBe(0);
  });
});
