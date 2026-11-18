import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LessonPlayer } from "@/features/learn/components/lesson-player";
import { QuickCheck } from "@/features/learn/components/lesson-blocks";
import { VideoPlayer } from "@/features/learn/components/video-player";
import { CertificatesList } from "@/features/learn/components/certificates-list";
import { BadgeShelf } from "@/features/learn/components/gamification";
import { StudentArea } from "@/features/learn/student-area";
import type { Badge, Certificate, LessonView, LessonProgressResult } from "@/features/learn/contract";
import { parseBlocks } from "@/features/learn/blocks";

import { StudentProvider, useStudent } from "@/features/learn/student-context";

import { useVisibleSeconds } from "@/hooks/use-visible-seconds";
import { me } from "../support/fixtures";
import { resetNavigation, router } from "../support/next-navigation";
import { apiErrorResponse, mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));
beforeEach(() => resetNavigation());

const maya = me({ id: "s1", role: "student", display_name: "Maya Lopez", grade_level: 2, email: null, username: "maya7" });

describe("StudentProvider and useStudent", () => {
  it("gives components the student, with first name and grade band", () => {
    const { result } = renderHook(() => useStudent(), { wrapper: ({ children }) => <StudentProvider user={maya}>{children}</StudentProvider> });
    expect(result.current).toMatchObject({ id: "s1", firstName: "Maya", gradeLevel: 2, gradeBand: "elementary" });
  });

  it("refuses to be used outside the student area, and refuses other roles", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useStudent())).toThrow(/only available in the student area/);
    expect(() => render(<StudentProvider user={me({ role: "parent" })}>x</StudentProvider>)).toThrow(/for students/);
  });
});

describe("useVisibleSeconds", () => {
  it("counts only visible time, and take() hands over new seconds once", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const { result } = renderHook(() => useVisibleSeconds());
    now = 12_500;
    expect(result.current.take()).toBe(12);
    now = 13_000;
    expect(result.current.take()).toBe(1); // the kept half second plus this one
    expect(result.current.take()).toBe(0);
  });

  it("reports the untaken seconds when the page is hidden", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const onHide = vi.fn();
    renderHook(() => useVisibleSeconds({ onHide }));
    now = 30_000;
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(onHide).toHaveBeenCalledWith(30);
    now = 90_000; // hidden: not counted
    visibility.mockReturnValue("visible");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    now = 95_000;
    visibility.mockReturnValue("hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(onHide).toHaveBeenLastCalledWith(5);
  });
});


// --- The lesson player ------------------------------------------------------------------------------

const outline = [
  { id: "l1", slug: "what-is-a-fraction", title: "What is a fraction?", position: 1, duration_minutes: 12, status: "not_started" as const, completed_at: null },
  { id: "l2", slug: "equivalent-fractions", title: "Equivalent fractions", position: 2, duration_minutes: 15, status: "not_started" as const, completed_at: null },
];

function lessonView(overrides: Partial<LessonView> = {}): LessonView {
  return {
    course: { id: "c1", slug: "fractions", title: "Fractions Made Simple", grade_level: 4, subject: { id: "s", slug: "mathematics", name: "Mathematics", description: null } },
    lesson: { id: "l1", slug: "what-is-a-fraction", title: "What is a fraction?", summary: "Part of a whole.", position: 1, duration_minutes: 12 },
    blocks: parseBlocks([
      { id: "intro", type: "text", heading: "Parts of a whole", paragraphs: ["Imagine a pizza."] },
      { id: "tip", type: "callout", tone: "remember", text: "The parts must be equal." },
    ]).blocks,
    enrolled: true,
    locked_reason: null,
    outline,
    progress: { status: "not_started", seconds_spent: 0, media_positions: {} },
    previous: null,
    next: { id: "l2", slug: "equivalent-fractions", title: "Equivalent fractions", position: 2 },
    ...overrides,
  };
}

function result(overrides: Partial<LessonProgressResult> = {}): LessonProgressResult {
  return { lesson_id: "l1", status: "started", seconds_spent: 0, completed_at: null, media_positions: {}, course_completed: false, duplicate: false, new_badges: [], level: { before: 1, after: 1 }, certificate: null, ...overrides };
}

const certificate: Certificate = {
  id: "cert1",
  code: "LUM-7K2Q-9XHD",
  student_name: "Maya Lopez",
  course_title: "Fractions Made Simple",
  subject_name: "Mathematics",
  grade_level: 4,
  lessons_count: 2,
  issued_at: "2026-03-02T10:00:00Z",
  course_slug: "fractions",
};

function renderPlayer(view: LessonView) {
  return renderWithProviders(
    <StudentArea user={maya}>
      <LessonPlayer initial={view} exitHref="/learn/courses/fractions" />
    </StudentArea>,
  );
}

describe("LessonPlayer", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the outline (current lesson marked), the content, and records the lesson as started", async () => {
    const reports: unknown[] = [];
    mockApi({
      "PUT /api/learn/lessons/l1/progress": ({ body }) => {
        reports.push(body);
        return Response.json(result());
      },
      "GET /api/learn/lessons/l1": () => Response.json(lessonView()),
    });
    renderPlayer(lessonView());
    const nav = screen.getAllByRole("navigation", { name: "Lessons in this course" })[0]!;
    expect(within(nav).getByRole("link", { name: /What is a fraction/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByText("0 of 2 lessons done · 0%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "What is a fraction?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Parts of a whole" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Remember" })).toHaveTextContent("The parts must be equal.");
    await waitFor(() => expect(reports).toEqual([expect.objectContaining({ status: "started", seconds: 0, report_id: expect.any(String) })]));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("marks the lesson done at once and goes to the next lesson", async () => {
    const reports: Array<{ status: string }> = [];
    mockApi({
      "PUT /api/learn/lessons/l1/progress": ({ body }) => {
        reports.push(body as { status: string });
        return Response.json(result({ status: (body as { status: "started" | "completed" }).status }));
      },
      "GET /api/learn/lessons/l1": () => Response.json(lessonView()),
    });
    const { user } = renderPlayer(lessonView());
    await user.click(screen.getByRole("button", { name: "Done, next lesson" }));
    expect(router.push).toHaveBeenCalledWith("/learn/courses/fractions/lessons/equivalent-fractions");
    await waitFor(() => expect(reports.some((report) => report.status === "completed")).toBe(true));
  });

  it("offline: keeps the student on the lesson, shows it done, and says the progress is saved on the device", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const fetchMock = mockApi({ "GET /api/learn/lessons/l1": () => Response.json(lessonView()) });
    const { user } = renderPlayer(lessonView());
    await user.click(screen.getByRole("button", { name: "Done, next lesson" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(await screen.findByText("Saved on this device")).toBeInTheDocument();
    expect(screen.getByText("Offline: saved on this device")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next lesson/ })).toBeInTheDocument(); // shown as done
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
    expect(window.localStorage.getItem("lumina:progress-queue")).toContain('"completed"');
    online.mockRestore();
  });

  it("asks to start the course when the student hasn't, and hides the content", async () => {
    let enrolled = false;
    mockApi({
      "POST /api/learn/enrollments": () => {
        enrolled = true;
        return Response.json({}, { status: 201 });
      },
      "GET /api/learn/lessons/l1": () => Response.json(lessonView({ enrolled })),
      "PUT /api/learn/lessons/l1/progress": () => Response.json(result()),
      "GET /api/learn/enrollments": () => Response.json([]),
      "GET /api/learn/summary": () => Response.json({}),
    });
    const { user } = renderPlayer(lessonView({ enrolled: false, blocks: [] }));
    expect(screen.getByText("Start Fractions Made Simple, Maya?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Done/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Start this course" }));
    expect(await screen.findByRole("button", { name: "Done, next lesson" })).toBeInTheDocument();
  });

  it("celebrates a finished course with its certificate", async () => {
    mockApi({
      "PUT /api/learn/lessons/l2/progress": ({ body }) =>
        Response.json(
          (body as { status: string }).status === "completed"
            ? result({ lesson_id: "l2", status: "completed", course_completed: true, certificate, new_badges: [{ id: "first-course", name: "Course champion", description: "Finish every lesson of a course.", icon: "trophy", earned_at: "2026-03-02T10:00:00Z" }] })
            : result({ lesson_id: "l2" }),
        ),
      "GET /api/learn/lessons/l2": () => Response.json(lessonView()),
    });
    const last = lessonView({
      lesson: { id: "l2", slug: "equivalent-fractions", title: "Equivalent fractions", summary: "Same amount.", position: 2, duration_minutes: 15 },
      previous: { id: "l1", slug: "what-is-a-fraction", title: "What is a fraction?", position: 1 },
      next: null,
    });
    const { user } = renderPlayer(last);
    expect(screen.getByRole("link", { name: "Previous lesson: What is a fraction?" })).toHaveAttribute("href", "/learn/courses/fractions/lessons/what-is-a-fraction");
    await user.click(screen.getByRole("button", { name: /^Done$/ }));
    const dialog = await screen.findByRole("dialog", { name: "You finished Fractions Made Simple!" });
    expect(within(dialog).getByRole("link", { name: "Download PDF" })).toHaveAttribute("href", "/api/learn/certificates/cert1/pdf");
    expect(within(dialog).getByRole("link", { name: /See my certificate/ })).toHaveAttribute("href", "/learn/certificates#certificate-cert1");
    expect(await screen.findByText("New badge: Course champion")).toBeInTheDocument();
  });
});

describe("QuickCheck", () => {
  it("says 'not quite' and lets the student try again, then confirms with the explanation", async () => {
    const block = parseBlocks([
      { id: "check", type: "check", prompt: "What fraction is coloured?", options: [{ id: "half", text: "1/2" }, { id: "quarter", text: "1/4" }], answer: "quarter", explanation: "One of four parts." },
    ]).blocks[0];
    const { user } = renderWithProviders(<QuickCheck block={block as never} />);
    const group = screen.getByRole("group", { name: /What fraction is coloured/ });
    const feedback = () => within(group.closest("form")!).getByRole("status");
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    await user.click(within(group).getByLabelText("1/2"));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(feedback()).toHaveTextContent("Not quite. Have another look and try again.");
    await user.click(within(group).getByLabelText("1/4"));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(feedback()).toHaveTextContent("Yes, that's it! One of four parts.");
  });
});

describe("VideoPlayer", () => {
  const block = parseBlocks([
    { id: "video", type: "video", title: "Halves", mp4: "/media/v.mp4", poster: "/media/p.jpg", duration_seconds: 24, captions: [{ src: "/media/v.vtt", lang: "en", label: "English", default: true }], transcript: "A fraction is a part of a whole." },
  ]).blocks[0] as never;

  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  });

  it("has labelled controls, captions on by default, speeds and a transcript", async () => {
    const { user, container } = renderWithProviders(<VideoPlayer video={block} />);
    const player = screen.getByRole("group", { name: "Video: Halves" });
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("poster", "/media/p.jpg");
    expect(video.querySelector("track")).toHaveAttribute("srclang", "en");
    fireEvent.loadedMetadata(video);
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    expect(screen.getByRole("slider", { name: "Position" })).toHaveAttribute("aria-valuetext", "0:00 of 0:24");
    const captions = screen.getByRole("button", { name: "Captions" });
    expect(captions).toHaveAttribute("aria-pressed", "true");
    // Keyboard on the player: C toggles captions, > speeds up.
    player.focus();
    await user.keyboard("c");
    expect(captions).toHaveAttribute("aria-pressed", "false");
    await user.keyboard(">");
    expect(screen.getByRole("combobox", { name: "Playback speed" })).toHaveValue("1.25");
    expect(video.playbackRate).toBe(1.25);
    await user.keyboard(" ");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    await user.click(screen.getByText("Transcript"));
    expect(screen.getByText("A fraction is a part of a whole.")).toBeVisible();
  });

  it("resumes where the student left off, with a way to start over, and reports the position on pause", async () => {
    const onPosition = vi.fn();
    const { user, container } = renderWithProviders(<VideoPlayer video={block} startAt={12.4} onPosition={onPosition} />);
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 24, configurable: true });
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBeCloseTo(12.4);
    expect(screen.getByText(/Carrying on from 0:12/)).toBeInTheDocument();
    fireEvent.pause(video);
    expect(onPosition).toHaveBeenCalledWith(12.4);
    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(video.currentTime).toBe(0);
  });

  it("explains a video that can't play, with Try again", async () => {
    const { container } = renderWithProviders(<VideoPlayer video={block} />);
    fireEvent.error(container.querySelector("video")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("This video can't play right now.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Certificates and badges", () => {
  it("lists certificates with preview and PDF links", async () => {
    mockApi({ "GET /api/learn/certificates": () => Response.json([certificate]) });
    const { user } = renderWithProviders(
      <StudentArea user={maya}>
        <CertificatesList />
      </StudentArea>,
    );
    expect(await screen.findByRole("heading", { name: "Fractions Made Simple" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Download PDF/ })[0]).toHaveAttribute("href", "/api/learn/certificates/cert1/pdf");
    expect(screen.getByRole("link", { name: /Open PDF/ })).toHaveAttribute("href", "/api/learn/certificates/cert1/pdf?inline=1");
    await user.click(screen.getByRole("button", { name: "Preview" }));
    const dialog = await screen.findByRole("dialog", { name: "Fractions Made Simple" });
    expect(within(dialog).getByText("Maya Lopez")).toBeInTheDocument();
    expect(within(dialog).getByText("LUM-7K2Q-9XHD")).toBeInTheDocument();
  });

  it("says what to do when there are no certificates yet, and explains a failed load", async () => {
    mockApi({ "GET /api/learn/certificates": () => Response.json([]) });
    const { unmount } = renderWithProviders(<CertificatesList />);
    expect(await screen.findByRole("heading", { name: "No certificates yet" })).toBeInTheDocument();
    unmount();
    mockApi({ "GET /api/learn/certificates": () => apiErrorResponse(503, "service_unavailable", "Lumina can't reach its database right now.") });
    renderWithProviders(<CertificatesList />);
    expect(await screen.findByRole("heading", { name: "Your certificates didn't load" })).toBeInTheDocument();
  });

  it("shows earned badges first, and says how to earn the rest", () => {
    const badges: Badge[] = [
      { id: "ten-lessons", name: "Busy learner", description: "Finish 10 lessons.", icon: "book", earned_at: null },
      { id: "first-lesson", name: "First step", description: "Finish your first lesson.", icon: "sprout", earned_at: "2026-03-02T10:00:00Z" },
    ];
    renderWithProviders(<BadgeShelf badges={badges} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("First step, earned");
    expect(items[0]).toHaveTextContent("Earned March 2, 2026");
    expect(items[1]).toHaveTextContent("Busy learner, not earned yet");
    expect(items[1]).toHaveTextContent("Finish 10 lessons.");
  });
});
