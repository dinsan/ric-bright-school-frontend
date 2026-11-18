import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { DELETE as deleteBookmark } from "@/app/api/learn/bookmarks/[bookmarkId]/route";
import { POST as enroll } from "@/app/api/learn/enrollments/route";
import { GET as annotations } from "@/app/api/learn/lessons/[lessonId]/annotations/route";
import { POST as addBookmark } from "@/app/api/learn/lessons/[lessonId]/bookmarks/route";
import { POST as addNote } from "@/app/api/learn/lessons/[lessonId]/notes/route";
import { GET as notebook } from "@/app/api/learn/notebook/route";
import { DELETE as deleteNote, PATCH as editNote } from "@/app/api/learn/notes/[noteId]/route";
import { GET as summary } from "@/app/api/learn/summary/route";
import { getDb } from "@/server/db";
import { Browser } from "../support/browser";
import { createCatalog, createUser, PASSWORD } from "../support/factories";

async function student(username = "kid1") {
  const user = await createUser({ role: "student", username });
  const browser = new Browser();
  expect((await browser.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username, password: PASSWORD } })).status).toBe(200);
  return { user, browser };
}

/** Fractions, started, with a text block and a video in its first lesson. */
async function setup(username = "kid1") {
  await createCatalog();
  const fractions = await getDb().course.findUniqueOrThrow({ where: { slug: "fractions" }, include: { lessons: { orderBy: { position: "asc" } } } });
  const lesson = fractions.lessons[0]!;
  await getDb().lesson.update({
    where: { id: lesson.id },
    data: {
      content: [
        { id: "intro", type: "text", heading: "Parts of a whole", paragraphs: ["A fraction is part of a whole."] },
        { id: "video", type: "video", title: "Halves", mp4: "/media/v.mp4", duration_seconds: 24, captions: [] },
      ],
    },
  });
  const { user, browser } = await student(username);
  await browser.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: fractions.id } });
  return { user, browser, lesson, fractions };
}

const note = (browser: Browser, lessonId: string, body: unknown) => browser.call(addNote, { method: "POST", path: "/api/learn/lessons/x/notes", params: { lessonId }, body });
const bookmark = (browser: Browser, lessonId: string, body: unknown = {}) => browser.call(addBookmark, { method: "POST", path: "/api/learn/lessons/x/bookmarks", params: { lessonId }, body });

describe("notes", () => {
  it("writes, lists, edits and deletes notes about the lesson or one part of it", async () => {
    const { browser, lesson } = await setup();
    const whole = await note(browser, lesson.id, { body: "  Halves are two equal parts.  " });
    expect(whole.status).toBe(201);
    expect(whole.body).toMatchObject({ body: "Halves are two equal parts.", block_id: null, new_badges: [] });
    const part = await note(browser, lesson.id, { body: "Watch again at home", block_id: "video" });
    expect(part.body.block_id).toBe("video");

    const listed = await browser.call(annotations, { path: "/api/learn/lessons/x/annotations", params: { lessonId: lesson.id } });
    expect(listed.body.notes.map((entry: { body: string }) => entry.body)).toEqual(["Halves are two equal parts.", "Watch again at home"]);

    const edited = await browser.call(editNote, { method: "PATCH", path: "/api/learn/notes/x", params: { noteId: whole.body.id }, body: { body: "Halves: 2 equal parts." } });
    expect(edited.body.body).toBe("Halves: 2 equal parts.");
    expect((await browser.call(deleteNote, { method: "DELETE", path: "/api/learn/notes/x", params: { noteId: part.body.id } })).status).toBe(204);
    expect((await browser.call(annotations, { path: "/api/learn/lessons/x/annotations", params: { lessonId: lesson.id } })).body.notes).toHaveLength(1);
    expect((await browser.call(summary, { path: "/api/learn/summary" })).body).toMatchObject({ notes_count: 1, bookmarks_count: 0 });
  });

  it("refuses empty or too long notes, unknown parts, and notes before the course is started", async () => {
    const { browser, lesson, fractions } = await setup();
    expect((await note(browser, lesson.id, { body: "   " })).body.error.details[0].field).toBe("body.body");
    expect((await note(browser, lesson.id, { body: "x".repeat(2001) })).status).toBe(422);
    expect((await note(browser, lesson.id, { body: "Hi", block_id: "nope" })).body.error.details[0].field).toBe("body.block_id");
    const { browser: other } = await student("other");
    const refused = await note(other, fractions.lessons[1]!.id, { body: "Hi" });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("not_enrolled");
  });

  it("keeps notes private: another student can't see, change or delete them", async () => {
    const { browser, lesson } = await setup();
    const mine = await note(browser, lesson.id, { body: "Secret" });
    const { browser: other } = await student("other");
    await other.call(enroll, { method: "POST", path: "/api/learn/enrollments", body: { course_id: lesson.courseId } });
    expect((await other.call(annotations, { path: "/api/learn/lessons/x/annotations", params: { lessonId: lesson.id } })).body.notes).toEqual([]);
    expect((await other.call(editNote, { method: "PATCH", path: "/api/learn/notes/x", params: { noteId: mine.body.id }, body: { body: "Hacked" } })).status).toBe(404);
    expect((await other.call(deleteNote, { method: "DELETE", path: "/api/learn/notes/x", params: { noteId: mine.body.id } })).status).toBe(404);
    expect((await other.call(notebook, { path: "/api/learn/notebook" })).body.notes).toEqual([]);
    // Parents and teachers can't use the student API at all.
    await createUser({ email: "mum@example.test" });
    const parent = new Browser();
    await parent.call(login, { method: "POST", path: "/api/auth/login", body: { email: "mum@example.test", password: PASSWORD } });
    expect((await parent.call(notebook, { path: "/api/learn/notebook" })).status).toBe(403);
  });

  it("earns the Note taker badge with the fifth note", async () => {
    const { browser, lesson } = await setup();
    for (let i = 1; i <= 4; i++) expect((await note(browser, lesson.id, { body: `Note ${i}` })).body.new_badges).toEqual([]);
    const fifth = await note(browser, lesson.id, { body: "Note 5" });
    expect(fifth.body.new_badges.map((badge: { id: string }) => badge.id)).toEqual(["note-taker"]);
  });
});

describe("bookmarks", () => {
  it("bookmarks the lesson, a part of it and moments in a video, once each", async () => {
    const { browser, lesson } = await setup();
    const whole = await bookmark(browser, lesson.id);
    expect(whole.status).toBe(201);
    expect(whole.body).toMatchObject({ block_id: null, media_seconds: null });
    expect((await bookmark(browser, lesson.id)).status).toBe(200); // the same one again: not a second
    expect((await bookmark(browser, lesson.id, { block_id: "intro" })).status).toBe(201);
    const moment = await bookmark(browser, lesson.id, { block_id: "video", media_seconds: 12.7, label: "The quarter part" });
    expect(moment.body).toMatchObject({ block_id: "video", media_seconds: 12, label: "The quarter part" });
    expect((await bookmark(browser, lesson.id, { block_id: "video", media_seconds: 20 })).status).toBe(201);
    const listed = await browser.call(annotations, { path: "/api/learn/lessons/x/annotations", params: { lessonId: lesson.id } });
    expect(listed.body.bookmarks).toHaveLength(4);
    expect((await browser.call(deleteBookmark, { method: "DELETE", path: "/api/learn/bookmarks/x", params: { bookmarkId: whole.body.id } })).status).toBe(204);
    expect((await browser.call(deleteBookmark, { method: "DELETE", path: "/api/learn/bookmarks/x", params: { bookmarkId: whole.body.id } })).status).toBe(404);
  });

  it("only bookmarks moments in videos", async () => {
    const { browser, lesson } = await setup();
    const refused = await bookmark(browser, lesson.id, { block_id: "intro", media_seconds: 5 });
    expect(refused.body.error.details[0].field).toBe("body.media_seconds");
    expect((await bookmark(browser, lesson.id, { media_seconds: 5 })).status).toBe(400);
  });
});

describe("notebook", () => {
  it("lists every note and bookmark with where it belongs and a link back to the spot", async () => {
    const { browser, lesson } = await setup();
    await note(browser, lesson.id, { body: "About the video", block_id: "video" });
    await note(browser, lesson.id, { body: "About everything" });
    await bookmark(browser, lesson.id, { block_id: "video", media_seconds: 12 });
    const book = await browser.call(notebook, { path: "/api/learn/notebook" });
    expect(book.status).toBe(200);
    expect(book.body.notes[0]).toMatchObject({
      body: "About everything",
      block_label: null,
      course: { slug: "fractions", title: "Fractions Made Simple" },
      lesson: { slug: "what-is-a-fraction", title: "What is a fraction?" },
      href: "/learn/courses/fractions/lessons/what-is-a-fraction",
    });
    expect(book.body.notes[1]).toMatchObject({ block_label: "Video: Halves", href: "/learn/courses/fractions/lessons/what-is-a-fraction#block-video" });
    expect(book.body.bookmarks[0]).toMatchObject({ media_seconds: 12, href: "/learn/courses/fractions/lessons/what-is-a-fraction?t=12#block-video" });

    const search = await browser.call(notebook, { path: "/api/learn/notebook?q=VIDEO" });
    expect(search.body.notes.map((entry: { body: string }) => entry.body)).toEqual(["About the video"]);
    // `%` typed in the search is a letter, not a wildcard.
    expect((await browser.call(notebook, { path: "/api/learn/notebook?q=%25" })).body.notes).toEqual([]);
  });

  it("keeps a note when the part it was about is removed from the lesson", async () => {
    const { browser, lesson } = await setup();
    await note(browser, lesson.id, { body: "About the video", block_id: "video" });
    await getDb().lesson.update({ where: { id: lesson.id }, data: { content: [{ id: "intro", type: "text", paragraphs: ["x"] }] } });
    const book = await browser.call(notebook, { path: "/api/learn/notebook" });
    expect(book.body.notes[0]).toMatchObject({ body: "About the video", block_label: null, href: "/learn/courses/fractions/lessons/what-is-a-fraction" });
  });
});
