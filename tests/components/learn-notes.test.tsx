import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseBlocks } from "@/features/learn/blocks";
import type { LessonAnnotations, LessonView, Notebook as NotebookData, NoteResult } from "@/features/learn/contract";
import { LessonPlayer } from "@/features/learn/components/lesson-player";
import { Notebook } from "@/features/learn/components/notebook";
import { NotesPanel } from "@/features/learn/components/notes-panel";
import { VideoPlayer } from "@/features/learn/components/video-player";
import { StudentArea } from "@/features/learn/student-area";
import { me } from "../support/fixtures";
import { resetNavigation, router, setLocation } from "../support/next-navigation";
import { apiErrorResponse, mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));
beforeEach(() => {
  resetNavigation();
  window.localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
});

const maya = me({ id: "s1", role: "student", display_name: "Maya", grade_level: 4, email: null, username: "maya7" });
const inStudentArea = (ui: ReactNode) => renderWithProviders(<StudentArea user={maya}>{ui}</StudentArea>);

const { blocks } = parseBlocks([
  { id: "intro", type: "text", heading: "Parts of a whole", paragraphs: ["A fraction is part of a whole."] },
  { id: "video", type: "video", title: "Halves", mp4: "/media/v.mp4", duration_seconds: 24, captions: [] },
]);

const note = (overrides: Partial<NoteResult> = {}): NoteResult => ({
  id: "n1",
  lesson_id: "l1",
  block_id: null,
  body: "Halves are two equal parts.",
  created_at: "2026-03-02T10:00:00Z",
  updated_at: "2026-03-02T10:00:00Z",
  new_badges: [],
  ...overrides,
});

describe("NotesPanel", () => {
  it("writes a note about a part of the lesson and lists it with a way back to that part", async () => {
    let posted: unknown = null;
    let data: LessonAnnotations = { notes: [], bookmarks: [] };
    mockApi({
      "GET /api/learn/lessons/l1/annotations": () => Response.json(data),
      "POST /api/learn/lessons/l1/notes": ({ body }) => {
        posted = body;
        const created = note({ id: "n2", block_id: "video", body: "Watch at home", new_badges: [{ id: "note-taker", name: "Note taker", description: "Write 5 notes in your lessons.", icon: "pencil", earned_at: "2026-03-02T10:00:00Z" }] });
        data = { ...data, notes: [created] };
        return Response.json(created, { status: 201 });
      },
      "GET /api/learn/notebook": () => Response.json({ notes: [], bookmarks: [] }),
      "GET /api/learn/summary": () => Response.json({}),
    });
    const onGoTo = vi.fn();
    const { user } = inStudentArea(<NotesPanel lessonId="l1" blocks={blocks} onGoTo={onGoTo} />);
    expect(await screen.findByText(/No notes in this lesson yet/)).toBeInTheDocument();
    // Saving nothing explains, without calling the server.
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByText("Write something first.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("New note"), "Watch at home");
    await user.selectOptions(screen.getByLabelText("About"), "Video: Halves");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() => expect(posted).toEqual({ body: "Watch at home", block_id: "video" }));
    expect(await screen.findByText("New badge: Note taker")).toBeInTheDocument();
    expect(screen.getByLabelText("New note")).toHaveValue("");
    expect(screen.getByLabelText("About")).toHaveValue(""); // back to "The whole lesson"

    const list = screen.getByRole("list", { name: "Your notes in this lesson" });
    await user.click(within(list).getByRole("button", { name: /Video: Halves/ }));
    expect(onGoTo).toHaveBeenCalledWith("video");
  });

  it("keeps the typed note when saving fails, and says why", async () => {
    mockApi({
      "GET /api/learn/lessons/l1/annotations": () => Response.json({ notes: [], bookmarks: [] }),
      "POST /api/learn/lessons/l1/notes": () => apiErrorResponse(503, "service_unavailable", "Lumina can't reach its database right now."),
    });
    const { user } = inStudentArea(<NotesPanel lessonId="l1" blocks={blocks} onGoTo={vi.fn()} />);
    await user.type(await screen.findByLabelText("New note"), "Don't lose me");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(await screen.findByText(/Your note wasn't saved: Lumina can't reach its database right now./)).toBeInTheDocument();
    expect(screen.getByLabelText("New note")).toHaveValue("Don't lose me");
  });

  it("edits and deletes (after asking) a note", async () => {
    const edits: unknown[] = [];
    let deleted = false;
    mockApi({
      "GET /api/learn/lessons/l1/annotations": () => Response.json({ notes: deleted ? [] : [note()], bookmarks: [] }),
      "PATCH /api/learn/notes/n1": ({ body }) => {
        edits.push(body);
        return Response.json(note({ body: (body as { body: string }).body }));
      },
      "DELETE /api/learn/notes/n1": () => {
        deleted = true;
        return new Response(null, { status: 204 });
      },
      "GET /api/learn/notebook": () => Response.json({ notes: [], bookmarks: [] }),
      "GET /api/learn/summary": () => Response.json({}),
    });
    const { user } = inStudentArea(<NotesPanel lessonId="l1" blocks={blocks} onGoTo={vi.fn()} />);
    await screen.findByText("Halves are two equal parts.");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Edit note"));
    await user.type(screen.getByLabelText("Edit note"), "Halves: 2 equal parts.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(edits).toEqual([{ body: "Halves: 2 equal parts." }]));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this note?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Halves are two equal parts.")).toBeNull());
  });

  it("lists bookmarks with Go there (to the video moment) and remove", async () => {
    mockApi({
      "GET /api/learn/lessons/l1/annotations": () =>
        Response.json({
          notes: [],
          bookmarks: [
            { id: "b1", lesson_id: "l1", block_id: null, media_seconds: null, label: null, created_at: "2026-03-02T10:00:00Z" },
            { id: "b2", lesson_id: "l1", block_id: "video", media_seconds: 75, label: "The quarter", created_at: "2026-03-02T10:00:00Z" },
          ],
        }),
    });
    const onGoTo = vi.fn();
    const { user } = inStudentArea(<NotesPanel lessonId="l1" blocks={blocks} onGoTo={onGoTo} defaultTab="bookmarks" />);
    const list = await screen.findByRole("list", { name: "Your bookmarks in this lesson" });
    expect(within(list).getByText("The whole lesson")).toBeInTheDocument();
    expect(within(list).getByText("Video: Halves at 1:15")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Go there" }));
    expect(onGoTo).toHaveBeenCalledWith("video", 75);
    expect(within(list).getByRole("button", { name: "Remove bookmark: Video: Halves at 1:15" })).toBeInTheDocument();
  });
});

describe("bookmarks in the lesson player", () => {
  const view: LessonView = {
    course: { id: "c1", slug: "fractions", title: "Fractions Made Simple", grade_level: 4, subject: { id: "s", slug: "mathematics", name: "Mathematics", description: null } },
    lesson: { id: "l1", slug: "what-is-a-fraction", title: "What is a fraction?", summary: "Part of a whole.", position: 1, duration_minutes: 12 },
    blocks,
    enrolled: true,
    locked_reason: null,
    outline: [{ id: "l1", slug: "what-is-a-fraction", title: "What is a fraction?", position: 1, duration_minutes: 12, status: "started", completed_at: null }],
    progress: { status: "started", seconds_spent: 0, media_positions: {} },
    previous: null,
    next: null,
  };

  it("bookmarks the lesson from the header (a toggle), and a video moment from under the video", async () => {
    const bookmarks: unknown[] = [];
    let list: LessonAnnotations["bookmarks"] = [];
    mockApi({
      "GET /api/learn/lessons/l1/annotations": () => Response.json({ notes: [], bookmarks: list }),
      "POST /api/learn/lessons/l1/bookmarks": ({ body }) => {
        bookmarks.push(body);
        const created = { id: `b${bookmarks.length}`, lesson_id: "l1", block_id: (body as { block_id?: string }).block_id ?? null, media_seconds: (body as { media_seconds?: number }).media_seconds ?? null, label: null, created_at: "2026-03-02T10:00:00Z" };
        list = [...list, created];
        return Response.json(created, { status: 201 });
      },
      "PUT /api/learn/lessons/l1/progress": () => Response.json({ lesson_id: "l1", status: "started", seconds_spent: 0, completed_at: null, media_positions: {}, course_completed: false, duplicate: false, new_badges: [], level: { before: 1, after: 1 }, certificate: null }),
      "GET /api/learn/lessons/l1": () => Response.json(view),
      "GET /api/learn/notebook": () => Response.json({ notes: [], bookmarks: [] }),
      "GET /api/learn/summary": () => Response.json({}),
      "GET /api/learn/enrollments": () => Response.json([]),
    });
    const { user, container } = inStudentArea(<LessonPlayer initial={view} exitHref="/learn/courses/fractions" />);
    const toggle = await screen.findByRole("button", { name: "Bookmark this lesson" });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    expect(await screen.findByRole("button", { name: "Bookmarked: remove the bookmark" })).toHaveAttribute("aria-pressed", "true");
    expect(bookmarks[0]).toEqual({});

    const video = container.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 24, configurable: true });
    fireEvent.loadedMetadata(video);
    video.currentTime = 12;
    fireEvent.timeUpdate(video);
    await user.click(screen.getByRole("button", { name: /Bookmark this moment \(0:12\)/ }));
    await waitFor(() => expect(bookmarks[1]).toEqual({ block_id: "video", media_seconds: 12 }));
    const moments = await screen.findByRole("group", { name: "Bookmarked moments" });
    expect(within(moments).getByRole("button", { name: "Jump to 0:12" })).toBeInTheDocument();
    // The Notes button says how many notes there are, in words that match what's shown.
    expect(screen.getByRole("button", { name: "Notes and bookmarks: no notes yet" })).toBeInTheDocument();
  });

  it("jumps a video to a bookmarked moment", () => {
    const { container, rerender } = renderWithProviders(<VideoPlayer video={blocks[1] as never} jumpTo={null} />);
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "readyState", { value: 1, configurable: true });
    rerender(<VideoPlayer video={blocks[1] as never} jumpTo={{ seconds: 18, key: 1 }} />);
    expect(video.currentTime).toBe(18);
  });
});

describe("Notebook (/learn/notes)", () => {
  const book: NotebookData = {
    notes: [
      {
        ...note({ id: "n1", block_id: "video", body: "Watch at home" }),
        course: { slug: "fractions", title: "Fractions Made Simple" },
        lesson: { id: "l1", slug: "what-is-a-fraction", title: "What is a fraction?" },
        block_label: "Video: Halves",
        href: "/learn/courses/fractions/lessons/what-is-a-fraction#block-video",
      },
    ],
    bookmarks: [
      {
        id: "b1",
        lesson_id: "l1",
        block_id: "video",
        media_seconds: 12,
        label: null,
        created_at: "2026-03-02T10:00:00Z",
        course: { slug: "fractions", title: "Fractions Made Simple" },
        lesson: { id: "l1", slug: "what-is-a-fraction", title: "What is a fraction?" },
        block_label: "Video: Halves",
        href: "/learn/courses/fractions/lessons/what-is-a-fraction?t=12#block-video",
      },
    ],
  };

  it("lists bookmarks and notes grouped by course and lesson, each opening its spot, and searches", async () => {
    setLocation("/learn/notes");
    mockApi({ "GET /api/learn/notebook": () => Response.json(book) });
    const { user } = inStudentArea(<Notebook />);
    const bookmarks = await screen.findByRole("region", { name: "Bookmarks (1)" });
    expect(within(bookmarks).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/learn/courses/fractions/lessons/what-is-a-fraction?t=12#block-video");
    expect(within(bookmarks).getByText("Fractions Made Simple · Video: Halves at 0:12")).toBeInTheDocument();
    const notes = screen.getByRole("region", { name: "Notes (1)" });
    expect(within(notes).getByRole("heading", { name: "Fractions Made Simple" })).toBeInTheDocument();
    expect(within(notes).getByRole("link", { name: /Video: Halves/ })).toHaveAttribute("href", "/learn/courses/fractions/lessons/what-is-a-fraction#block-video");
    expect(within(notes).getByText("Watch at home")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search your notes"), "home");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(router.replace).toHaveBeenCalledWith("/learn/notes?q=home", { scroll: false });
  });

  it("explains how to start when there is nothing yet", async () => {
    setLocation("/learn/notes");
    mockApi({ "GET /api/learn/notebook": () => Response.json({ notes: [], bookmarks: [] }) });
    inStudentArea(<Notebook />);
    expect(await screen.findByRole("heading", { name: "No notes or bookmarks yet" })).toBeInTheDocument();
  });
});
