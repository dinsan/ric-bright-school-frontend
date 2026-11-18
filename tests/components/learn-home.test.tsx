import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bestMatch } from "@/components/layout/app-nav";
import { visibleNavItems } from "@/config/navigation";
import type { CourseRecommendation, LearningPathView, LearningSummary, ReviewOverview as Overview, ReviewQuestion, StudentAssignment } from "@/features/learn/contract";
import { AssignmentsList } from "@/features/learn/components/assignments-list";
import { CourseHome } from "@/features/learn/components/course-home";
import { LearningPath } from "@/features/learn/components/learning-path";
import { PracticeSession } from "@/features/learn/components/practice-session";
import { ReviewOverview } from "@/features/learn/components/review-overview";
import { StudentDashboard } from "@/features/learn/components/student-dashboard";
import { StudentArea } from "@/features/learn/student-area";
import type { ReactNode } from "react";
import { me } from "../support/fixtures";
import { resetNavigation, router, setLocation } from "../support/next-navigation";
import { mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));
beforeEach(() => {
  resetNavigation();
  window.localStorage.clear();
});

const leo = me({ id: "s1", role: "student", display_name: "Leo", grade_level: 5, email: null, username: "leo10", timezone: "UTC" });
const inStudentArea = (ui: ReactNode) => renderWithProviders(<StudentArea user={leo}>{ui}</StudentArea>);
const subject = { id: "m", slug: "mathematics", name: "Mathematics", description: null };
const DAY = 86_400_000;

function summary(overrides: Partial<LearningSummary> = {}): LearningSummary {
  return {
    streak_days: 2,
    longest_streak_days: 2,
    xp: 90,
    level: { level: 1, xp_into_level: 90, xp_for_next_level: 100 },
    lessons_completed: 4,
    courses_completed: 1,
    minutes_last_7_days: 40,
    continue_learning: null,
    minutes_total: 40,
    badges_earned: 2,
    certificates: 1,
    review_due: 4,
    notes_count: 0,
    bookmarks_count: 0,
    ...overrides,
  };
}

function assignment(overrides: Partial<StudentAssignment> = {}): StudentAssignment {
  return {
    id: "a1",
    title: "Equivalent fractions",
    instructions: "Use the fraction wall.",
    due_at: new Date(Date.now() + DAY).toISOString(),
    class_name: "Class 5L",
    teacher_name: "Tom Teacher",
    course: { id: "c1", slug: "fractions", title: "Fractions Made Simple" },
    lesson: { id: "l2", slug: "equivalent-fractions", title: "Equivalent fractions", position: 2 },
    status: "not_started",
    lessons_done: 0,
    lessons_total: 1,
    href: "/learn/courses/fractions/lessons/equivalent-fractions",
    ...overrides,
  };
}

const recommendation: CourseRecommendation = {
  course: { id: "r1", slug: "ratios", title: "Ratios and Rates", summary: "Ratio language.", grade_level: 6, subject },
  reason: "Next after Decimals and Percentages",
};

describe("student navigation", () => {
  it("has six items, and Achievements covers badges and certificates", () => {
    const items = visibleNavItems("student");
    expect(items.map((item) => item.label)).toEqual(["Home", "My courses", "Learning path", "Assignments", "Review", "Achievements"]);
    expect(bestMatch(items, "/learn/certificates")).toBe("/learn/badges");
    expect(bestMatch(items, "/learn/courses/fractions")).toBe("/learn/courses");
    expect(bestMatch(items, "/learn")).toBe("/learn");
    expect(bestMatch(items, "/learn/review")).toBe("/learn/review");
  });
});

describe("StudentDashboard (the entry screen)", () => {
  function mockDashboard(overrides: { summary?: LearningSummary; assignments?: StudentAssignment[] } = {}) {
    return mockApi({
      "GET /api/learn/summary": () => Response.json(overrides.summary ?? summary()),
      "GET /api/learn/badges": () => Response.json([]),
      "GET /api/learn/enrollments": () => Response.json([]),
      "GET /api/learn/assignments": () => Response.json(overrides.assignments ?? [assignment(), assignment({ id: "a2", title: "Later work", due_at: new Date(Date.now() + 20 * DAY).toISOString() })]),
      "GET /api/learn/recommendations": () => Response.json([recommendation]),
    });
  }

  it("puts the soonest assignment first when nothing is in progress, then review, due soon and recommendations", async () => {
    mockDashboard();
    inStudentArea(<StudentDashboard />);
    expect(await screen.findByText("Next up: assigned by Tom Teacher")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "4 questions to review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start review" })).toHaveAttribute("href", "/learn/review/session?mode=review");
    const due = screen.getByRole("region", { name: "Due soon" });
    // Only work due within a week is "due soon".
    expect(within(due).getByRole("link", { name: "Equivalent fractions" })).toHaveAttribute("href", "/learn/courses/fractions/lessons/equivalent-fractions");
    expect(within(due).queryByText("Later work")).toBeNull();
    expect(within(due).getByText("Due tomorrow")).toBeInTheDocument();
    const recommended = await screen.findByRole("region", { name: "Recommended for you" });
    expect(within(recommended).getByRole("link", { name: /Ratios and Rates/ })).toHaveAttribute("href", "/learn/courses/ratios");
    expect(within(recommended).getByText("Next after Decimals and Percentages")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See my path" })).toHaveAttribute("href", "/learn/path");
  });

  it("prefers the course in progress for the first card, and hides review when nothing is due", async () => {
    mockDashboard({
      summary: summary({
        review_due: 0,
        continue_learning: { course: { id: "c1", slug: "fractions", title: "Fractions Made Simple", summary: "", grade_level: 4, subject }, lesson: { id: "l2", slug: "equivalent-fractions", title: "Equivalent fractions", position: 2 } },
      }),
      assignments: [],
    });
    inStudentArea(<StudentDashboard />);
    expect(await screen.findByText("Continue learning")).toBeInTheDocument();
    expect(screen.queryByText(/to review/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Due soon" })).toBeNull();
  });
});

describe("AssignmentsList", () => {
  it("groups work by urgency, with class, teacher, due date and the way in", async () => {
    mockApi({
      "GET /api/learn/assignments": () =>
        Response.json([
          assignment({ id: "late", title: "Late work", due_at: new Date(Date.now() - 2 * DAY).toISOString() }),
          assignment(),
          assignment({ id: "course", title: "Finish Fractions", lesson: null, lessons_total: 4, lessons_done: 1, status: "in_progress", due_at: new Date(Date.now() + 30 * DAY).toISOString(), href: "/learn/courses/fractions" }),
          assignment({ id: "done", title: "Done work", status: "done", lessons_done: 1 }),
        ]),
    });
    inStudentArea(<AssignmentsList />);
    expect(await screen.findByRole("heading", { name: "Overdue (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Due this week (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Later (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done (1)" })).toBeInTheDocument();
    expect(screen.getByText("Overdue by 2 days")).toBeInTheDocument();
    expect(screen.getByText("The whole course: Fractions Made Simple")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progress" })).toHaveAttribute("aria-valuetext", "1 of 4 lessons done");
    expect(screen.getByRole("link", { name: /Continue/ })).toHaveAttribute("href", "/learn/courses/fractions");
  });

  it("says there is nothing set when there isn't", async () => {
    mockApi({ "GET /api/learn/assignments": () => Response.json([]) });
    inStudentArea(<AssignmentsList />);
    expect(await screen.findByRole("heading", { name: "No assignments" })).toBeInTheDocument();
  });
});

describe("LearningPath", () => {
  const view: LearningPathView = {
    subject,
    subjects: [subject, { id: "s", slug: "science", name: "Science", description: null }],
    student_grade: 5,
    steps: [
      { course: { id: "c4", slug: "fractions", title: "Fractions", summary: "", grade_level: 4 }, status: "available", locked_reason: null, earlier_grade: true, lessons_done: 0, lessons_total: 4 },
      { course: { id: "c5", slug: "decimals", title: "Decimals", summary: "", grade_level: 5 }, status: "done", locked_reason: null, earlier_grade: false, lessons_done: 4, lessons_total: 4 },
      { course: { id: "c6", slug: "ratios", title: "Ratios", summary: "", grade_level: 6 }, status: "next", locked_reason: null, earlier_grade: false, lessons_done: 0, lessons_total: 4 },
      { course: { id: "c7", slug: "pre-algebra", title: "Pre-algebra", summary: "", grade_level: 7 }, status: "locked", locked_reason: "Finish Ratios (Grade 6) first.", earlier_grade: false, lessons_done: 0, lessons_total: 4 },
    ],
  };

  it("shows each course's status, why locked ones are locked, and where to start", async () => {
    setLocation("/learn/path");
    const fetchMock = mockApi({ "GET /api/learn/path": () => Response.json(view) });
    const { user } = inStudentArea(<LearningPath />);
    const path = await screen.findByRole("list", { name: "Mathematics learning path" });
    const steps = within(path).getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("Grade 4 · for practice");
    expect(steps[1]).toHaveTextContent("Done");
    expect(within(steps[2]!).getByRole("link", { name: "Start here" })).toHaveAttribute("href", "/learn/courses/ratios");
    expect(steps[3]).toHaveTextContent("Locked: Finish Ratios (Grade 6) first.");
    expect(within(steps[3]!).queryByRole("link")).toBeNull(); // a locked course isn't a link
    expect(screen.getByText("Mathematics: 1 of 4 courses done")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Subject"), "science");
    expect(router.replace).toHaveBeenCalledWith("/learn/path?subject=science", { scroll: false });
    expect(new URL(String(fetchMock.mock.calls[0]![0])).searchParams.get("subject")).toBeNull();
  });
});

describe("Review and practice", () => {
  const overview: Overview = { due_count: 2, total_count: 5, next_due_at: null, courses: [{ course: { id: "c5", slug: "decimals", title: "Decimals" }, questions: 5, due: 2 }] };
  const question = (id: string, prompt: string): ReviewQuestion => ({
    id,
    prompt,
    options: [
      { id: "a", text: "Wrong one" },
      { id: "b", text: "Right one" },
    ],
    lesson: { slug: "tenths", title: "Tenths" },
    course: { slug: "decimals", title: "Decimals" },
    strength: "new",
  });

  it("shows what is due and offers review and practice per course", async () => {
    mockApi({ "GET /api/learn/review": () => Response.json(overview) });
    inStudentArea(<ReviewOverview />);
    expect(await screen.findByRole("heading", { name: "2 questions to review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start review" })).toHaveAttribute("href", "/learn/review/session?mode=review");
    expect(screen.getByRole("link", { name: "Practise Decimals" })).toHaveAttribute("href", "/learn/review/session?mode=practice&course=c5");
  });

  it("explains the queue before there's anything in it", async () => {
    mockApi({ "GET /api/learn/review": () => Response.json({ due_count: 0, total_count: 0, next_due_at: null, courses: [] }) });
    inStudentArea(<ReviewOverview />);
    expect(await screen.findByRole("heading", { name: "Nothing to review yet" })).toBeInTheDocument();
  });

  it("asks one question at a time, explains the answer, brings a missed question back once, and sums up", async () => {
    const answers: Array<{ id: string; body: unknown }> = [];
    mockApi({
      "GET /api/learn/review/session": () => Response.json({ mode: "review", questions: [question("q1", "First?"), question("q2", "Second?")] }),
      "POST /api/learn/review/q1/answer": ({ body }) => {
        answers.push({ id: "q1", body });
        const correct = (body as { choice: string }).choice === "b";
        return Response.json({ correct, answer: "b", explanation: "Because.", scheduled: (body as { mode: string }).mode === "review", next_due_at: "", interval_days: correct ? 3 : 1, strength: "new" });
      },
      "POST /api/learn/review/q2/answer": ({ body }) => {
        answers.push({ id: "q2", body });
        return Response.json({ correct: true, answer: "b", explanation: null, scheduled: true, next_due_at: "", interval_days: 3, strength: "learning" });
      },
      "GET /api/learn/review": () => Response.json(overview),
      "GET /api/learn/summary": () => Response.json(summary()),
    });
    const { user } = inStudentArea(<PracticeSession mode="review" />);
    expect(await screen.findByRole("heading", { level: 1, name: "First?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    await user.click(screen.getByLabelText("Wrong one"));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Not quite. The right answer: “Right one”")).toBeInTheDocument();
    expect(screen.getByText("Next time you'll see this question tomorrow.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next question" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Next question" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Second?" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Right one"));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Yes, that's right!")).toBeInTheDocument();
    expect(screen.getByText("Next time you'll see this question in 3 days.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next question" }));

    // The missed question once more, as practice (not rescheduled again).
    expect(await screen.findByRole("heading", { level: 1, name: "First?" })).toBeInTheDocument();
    expect(screen.getByText("Second try")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Right one"));
    await user.click(screen.getByRole("button", { name: "Check" }));
    await screen.findByText("Yes, that's right!");
    await user.click(screen.getByRole("button", { name: "See how you did" }));
    expect(await screen.findByRole("heading", { name: "Session done" })).toBeInTheDocument();
    expect(screen.getByText(/You got 1 of 2 right first time/)).toBeInTheDocument();
    expect(answers.map((entry) => [entry.id, (entry.body as { mode: string }).mode])).toEqual([
      ["q1", "review"],
      ["q2", "review"],
      ["q1", "practice"],
    ]);
  });

  it("offers practice when nothing is due", async () => {
    mockApi({ "GET /api/learn/review/session": () => Response.json({ mode: "review", questions: [] }) });
    inStudentArea(<PracticeSession mode="review" />);
    expect(await screen.findByRole("heading", { name: "Nothing to review right now" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Practise anyway" })).toHaveAttribute("href", "/learn/review/session?mode=practice");
  });
});

describe("CourseHome with a lock", () => {
  it("says why the course is locked instead of offering Start", () => {
    mockApi({});
    inStudentArea(
      <CourseHome
        course={{ id: "c7", slug: "pre-algebra", title: "Pre-algebra", summary: "Equations.", grade_level: 7, subject: { name: "Mathematics" } }}
        initial={{ course_id: "c7", enrolled: false, locked_reason: "Finish Ratios (Grade 6) first.", lessons: [], summary: { lessons_total: 0, lessons_completed: 0, percent: 0, next_lesson: null } }}
      />,
    );
    expect(screen.getByText("Finish Ratios (Grade 6) first.", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See your learning path" })).toHaveAttribute("href", "/learn/path");
    expect(screen.queryByRole("button", { name: /Start this course/ })).toBeNull();
  });
});
