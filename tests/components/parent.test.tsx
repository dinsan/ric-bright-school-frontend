import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildOverview, ChildProgress, ParentalControlsView } from "@/features/family/contract";
import { ChildOverviewCard } from "@/features/family/components/child-overview-card";
import { ChildProgressView } from "@/features/family/components/child-progress";
import { ControlsForm } from "@/features/family/components/controls-form";
import { ReportDownload } from "@/features/family/components/report-download";
import { LearningControlsGate, LearningReminder } from "@/features/learn/components/learning-controls";
import type { StudentControls } from "@/features/learn/controls";
import { resetNavigation, router } from "../support/next-navigation";
import { mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));
beforeEach(() => resetNavigation());

const NOW = new Date("2026-11-16T12:00:00Z");
const leo = { id: "c1", display_name: "Leo Park", grade_level: 5, username: "leo10", sign_in_method: "password" as const };
const noControls = { daily_minutes: null, bedtime: null, when_reached: "remind" as const };

function card(overrides: Partial<ChildOverview> = {}): ChildOverview {
  return {
    child: leo,
    last_active_at: "2026-11-16T09:00:00.000Z",
    streak_days: 3,
    minutes_last_7_days: 95,
    lessons_completed: 12,
    courses_in_progress: 2,
    courses_completed: 1,
    level: 2,
    latest_quiz: { quiz: "Fractions check-up", course: "Fractions", status: "submitted", score: 7, max_score: 8, percent: 88, pending_review: 1, question_count: 9, started_at: "2026-11-16T08:00:00.000Z", submitted_at: "2026-11-16T08:20:00.000Z" },
    work: { overdue: 1, due_soon: 2 },
    controls: { daily_minutes: 30, bedtime: { start: "20:00", end: "07:00" }, when_reached: "pause" },
    ...overrides,
  };
}

function progress(overrides: Partial<ChildProgress> = {}): ChildProgress {
  const days = Array.from({ length: 14 }, (_, index) => ({ day: `2026-11-${String(3 + index).padStart(2, "0")}`, minutes: index === 13 ? 15 : index === 10 ? 20 : 0, lessons_completed: index === 13 ? 2 : 0 }));
  return {
    child: leo,
    generated_at: NOW.toISOString(),
    period: { days: 14, from: "2026-11-03", to: "2026-11-16", minutes: 35, active_days: 2, lessons_completed: 2, quizzes_finished: 1 },
    summary: { last_active_at: NOW.toISOString(), streak_days: 1, longest_streak_days: 3, minutes_last_7_days: 35, minutes_total: 200, lessons_completed: 12, courses_completed: 1, xp: 170, level: 2, badges_earned: 2, quiz_average_percent: 56 },
    courses: [
      { id: "k1", title: "Fractions Made Simple", subject: "Mathematics", grade_level: 4, enrolled_at: "2026-11-10T10:00:00Z", completed_at: null, last_activity_at: "2026-11-16T09:00:00Z", lessons_total: 4, lessons_completed: 1, percent: 25, next_lesson: "Equivalent fractions" },
      { id: "k2", title: "Decimals", subject: "Mathematics", grade_level: 5, enrolled_at: "2026-11-01T10:00:00Z", completed_at: "2026-11-05T10:00:00Z", last_activity_at: "2026-11-05T10:00:00Z", lessons_total: 4, lessons_completed: 4, percent: 100, next_lesson: null },
    ],
    quizzes: [card().latest_quiz!, { ...card().latest_quiz!, quiz: "Halves", score: 2, max_score: 5, percent: 40, pending_review: 0 }],
    assignments: [
      { id: "a1", title: "Equivalent fractions homework", class_name: "Class 5L", teacher_name: "Tom Teacher", course: "Fractions", lesson: "Equivalent fractions", due_at: "2026-11-14T10:00:00Z", due_label: "Overdue by 2 days", due_tone: "overdue", status: "not_started", lessons_done: 0, lessons_total: 1 },
    ],
    learning_days: days,
    badges: [{ name: "First step", description: "Finish your first lesson.", earned_at: "2026-11-01T10:00:00Z" }],
    certificates: [{ course: "Decimals", code: "LUM-AAAA-BBBB", issued_at: "2026-11-05T10:00:00Z" }],
    activity: [{ at: "2026-11-16T08:20:00.000Z", kind: "quiz_finished", text: "Finished the quiz “Fractions check-up”: 7 of 8 points (88%)", course: "Fractions" }],
    insights: { doing_well: ["Finished the course “Decimals”."], to_practise: ["The quiz “Halves” (40%): worth taking again."] },
    controls: noControls,
    ...overrides,
  };
}

describe("parent dashboard", () => {
  it("shows a child's week on their card, with a way to their page", () => {
    render(<ChildOverviewCard card={card()} now={NOW} timeZone="UTC" />);
    const group = screen.getByRole("group", { name: "Leo Park" });
    expect(within(group).getByText("Grade 5 · Active today")).toBeInTheDocument();
    expect(within(group).getByText("1 h 35 min")).toBeInTheDocument();
    expect(within(group).getByText("3 days")).toBeInTheDocument();
    expect(within(group).getByText("12")).toBeInTheDocument();
    expect(within(group).getByText("2 going · 1 done")).toBeInTheDocument();
    expect(within(group).getByText(/Fractions check-up, 7 of 8 points \(88%\)/)).toBeInTheDocument();
    expect(within(group).getByText("1 overdue")).toBeInTheDocument();
    expect(within(group).getByText("2 due this week")).toBeInTheDocument();
    expect(within(group).getByText(/Controls on · 30 min a day · bedtime 20:00–07:00/)).toBeInTheDocument();
    expect(within(group).getByRole("link", { name: "See Leo's progress" })).toHaveAttribute("href", "/family/children/c1");
  });

  it("reads calmly for a child who hasn't started", () => {
    render(<ChildOverviewCard card={card({ last_active_at: null, streak_days: 0, minutes_last_7_days: 0, lessons_completed: 0, courses_in_progress: 0, courses_completed: 0, latest_quiz: null, work: { overdue: 0, due_soon: 0 }, controls: noControls })} now={NOW} timeZone="UTC" />);
    expect(screen.getByText("Grade 5 · Not active yet")).toBeInTheDocument();
    expect(screen.getByText(/none yet/)).toBeInTheDocument();
    expect(screen.getByText("nothing due this week")).toBeInTheDocument();
    expect(screen.queryByText(/Controls on/)).not.toBeInTheDocument();
  });
});

describe("a child's page", () => {
  it("shows the numbers, insights, courses, quiz results, work, learning time and activity", () => {
    render(<ChildProgressView progress={progress()} timeZone="UTC" controlsHref="/family/children/c1/controls" />);
    for (const heading of ["Doing well", "Worth practising", "Courses", "Quiz results", "Work set by teachers", "Learning time", "Recent activity", "Badges and certificates", "Parental controls"]) {
      expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText("Time in lessons, last 14 days").closest("div")).toHaveTextContent("35 minon 2 days");
    expect(screen.getByText("Quiz average").closest("div")).toHaveTextContent("56%");
    expect(screen.getByRole("progressbar", { name: "Fractions Made Simple progress" })).toHaveAttribute("aria-valuetext", "1 of 4 lessons · 25%");
    expect(screen.getByText("Next lesson: Equivalent fractions")).toBeInTheDocument();
    expect(screen.getByText("Finished Nov 5, 2026")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("+ 1 written, not marked")).toBeInTheDocument();
    expect(screen.getByText("Overdue by 2 days")).toBeInTheDocument();
    expect(screen.getByText("The quiz “Halves” (40%): worth taking again.")).toBeInTheDocument();
    // The chart's numbers are in a table for screen readers.
    const table = screen.getByRole("table", { name: "Minutes in lessons per day" });
    expect(within(table).getAllByRole("row")).toHaveLength(15);
    expect(within(table).getByRole("rowheader", { name: "Mon Nov 16" }).closest("tr")).toHaveTextContent("152");
    expect(screen.getByText("35 minutes in 14 days, on 2 days.")).toBeInTheDocument();
    expect(screen.getByText("Finished the quiz “Fractions check-up”: 7 of 8 points (88%)")).toBeInTheDocument();
    expect(screen.getByText("No limits set.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change Leo's controls" })).toHaveAttribute("href", "/family/children/c1/controls");
  });

  it("explains every empty section for a child who hasn't started", () => {
    const empty = progress({
      courses: [],
      quizzes: [],
      assignments: [],
      activity: [],
      badges: [],
      certificates: [],
      insights: { doing_well: [], to_practise: [] },
      learning_days: progress().learning_days.map((day) => ({ ...day, minutes: 0, lessons_completed: 0 })),
      period: { days: 14, from: "2026-11-03", to: "2026-11-16", minutes: 0, active_days: 0, lessons_completed: 0, quizzes_finished: 0 },
      summary: { ...progress().summary, quiz_average_percent: null },
    });
    render(<ChildProgressView progress={empty} timeZone="UTC" controlsHref="/x" />);
    expect(screen.getByText("Leo hasn't started a course yet.")).toBeInTheDocument();
    expect(screen.getByText("No quizzes taken yet.")).toBeInTheDocument();
    expect(screen.getByText(/No work set by a teacher/)).toBeInTheDocument();
    expect(screen.getByText("No time in lessons in the last 14 days.")).toBeInTheDocument();
    expect(screen.getByText(/Nothing yet. Lessons, quizzes/)).toBeInTheDocument();
    expect(screen.getByText("no quizzes yet")).toBeInTheDocument();
  });

  it("downloads the report with a plain form: the period, then the button", () => {
    render(<ReportDownload childId="c1" />);
    const button = screen.getByRole("button", { name: "Download report (PDF)" });
    const form = button.closest("form")!;
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/api/me/children/c1/report");
    const period = screen.getByRole("combobox", { name: "Report period" });
    expect(period).toHaveAttribute("name", "days");
    expect(period).toHaveValue("30");
    expect(within(period).getAllByRole("option").map((option) => option.textContent)).toEqual(["Last 7 days", "Last 30 days", "Last 90 days"]);
  });
});

describe("parental controls form", () => {
  const initial: ParentalControlsView = { ...noControls, updated_at: null, updated_by: null };

  it("sets a daily limit and a bedtime, shows what the child gets, and saves", async () => {
    const saves: unknown[] = [];
    mockApi({
      "PUT /api/me/children/c1/controls": ({ body }) => {
        saves.push(body);
        return Response.json({ ...(body as object), updated_at: NOW.toISOString(), updated_by: "you" });
      },
    });
    const { user } = renderWithProviders(<ControlsForm childId="c1" name="Leo Park" initial={initial} timeZone="UTC" />);
    expect(screen.getByText("No controls set yet.")).toBeInTheDocument();
    expect(screen.getByText("No limits set.")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /Time in lessons each day/ }), "30 minutes");
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Set a bedtime for Leo/ }));
    expect(screen.getByLabelText(/From/)).toHaveValue("20:00");
    expect(screen.getByLabelText(/Until/)).toHaveValue("07:00");
    await user.click(screen.getByRole("radio", { name: /Lessons and quizzes pause/ }));
    const summary = screen.getByText("What Leo gets").closest("div")!;
    expect(summary).toHaveTextContent("Up to 30 minutes of lessons a day.");
    expect(summary).toHaveTextContent("Bedtime from 20:00 to 07:00.");
    expect(summary).toHaveTextContent("Then lessons and quizzes pause");

    await user.click(screen.getByRole("button", { name: "Save controls" }));
    expect(await screen.findByText("Controls saved")).toBeInTheDocument();
    expect(saves).toEqual([{ daily_minutes: 30, bedtime: { start: "20:00", end: "07:00" }, when_reached: "pause" }]);
    expect(screen.getByText(/Last changed by you/)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("stops a bedtime that starts and ends at the same time", async () => {
    const fetchMock = mockApi({});
    const { user } = renderWithProviders(<ControlsForm childId="c1" name="Leo" initial={initial} timeZone="UTC" />);
    await user.click(screen.getByRole("checkbox", { name: /Set a bedtime/ }));
    const until = screen.getByLabelText(/Until/);
    await user.clear(until);
    await user.type(until, "20:00");
    await user.click(screen.getByRole("button", { name: "Save controls" }));
    expect(await screen.findByText("Bedtime needs different start and end times.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the child's side of the controls", () => {
  afterEach(() => vi.useRealTimers());
  const student = (overrides: Partial<StudentControls>): StudentControls => ({ ...noControls, minutes_today: 0, ...overrides });

  it("shows the break screen on lessons and quizzes when the parent chose pause", () => {
    renderWithProviders(
      <LearningControlsGate initial={student({ daily_minutes: 30, minutes_today: 31, when_reached: "pause" })}>
        <p>The lesson</p>
      </LearningControlsGate>,
    );
    expect(screen.queryByText("The lesson")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Time for a break" })).toBeInTheDocument();
    expect(screen.getByText(/You've learned for 30 minutes today, the time your parent chose/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/learn");
  });

  it("only reminds when the parent chose a reminder, once", () => {
    const { rerender } = renderWithProviders(
      <LearningControlsGate initial={student({ daily_minutes: 15, minutes_today: 20 })}>
        <p>The lesson</p>
      </LearningControlsGate>,
    );
    expect(screen.getByText("The lesson")).toBeInTheDocument();
    expect(screen.getAllByText("Time for a break?")).toHaveLength(1);
    // The next page (same tab): no second reminder.
    rerender(
      <LearningControlsGate initial={student({ daily_minutes: 15, minutes_today: 21 })}>
        <p>The next lesson</p>
      </LearningControlsGate>,
    );
    expect(screen.getByText("The next lesson")).toBeInTheDocument();
    expect(screen.getAllByText("Time for a break?")).toHaveLength(1);
  });

  it("knows bedtime from the device clock", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 16, 21, 15));
    renderWithProviders(
      <LearningControlsGate initial={student({ bedtime: { start: "20:00", end: "07:00" }, when_reached: "pause" })}>
        <p>The quiz</p>
      </LearningControlsGate>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "It's bedtime" })).toBeInTheDocument();
    expect(screen.getByText(/open again at 07:00/)).toBeInTheDocument();
  });

  it("shows a banner on the other student pages, and nothing without limits", () => {
    const { unmount } = renderWithProviders(<LearningReminder initial={student({ daily_minutes: 45, minutes_today: 50, when_reached: "pause" })} />);
    expect(screen.getByText("Time for a break")).toBeInTheDocument();
    unmount();
    renderWithProviders(<LearningReminder initial={student({ daily_minutes: 45, minutes_today: 10 })} />);
    expect(screen.queryByText("Time for a break")).not.toBeInTheDocument();
  });
});
