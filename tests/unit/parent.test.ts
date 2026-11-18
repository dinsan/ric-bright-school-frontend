import { describe, expect, it } from "vitest";
import type { QuizResultRow } from "@/features/family/contract";
import { formatDay, shortMinutes } from "@/features/family/format";
import { buildActivity, buildInsights, lastActiveLabel, quizAverage, quizPercent, scoreText } from "@/features/family/insights";
import { controlState, describeControls, formatMinutes, inBedtime, minutesOfDay, parentalControlsInput, type StudentControls } from "@/features/learn/controls";

const at = (hours: number, minutes = 0) => new Date(2026, 10, 16, hours, minutes); // local time, like the child's device
const controls = (overrides: Partial<StudentControls> = {}): StudentControls => ({ daily_minutes: null, bedtime: null, when_reached: "remind", minutes_today: 0, ...overrides });

describe("parental controls", () => {
  it("reads bedtime windows, including ones past midnight", () => {
    expect(minutesOfDay("20:30")).toBe(1230);
    const night = { start: "20:00", end: "07:00" };
    expect(inBedtime(night, minutesOfDay("19:59"))).toBe(false);
    expect(inBedtime(night, minutesOfDay("20:00"))).toBe(true);
    expect(inBedtime(night, minutesOfDay("23:30"))).toBe(true);
    expect(inBedtime(night, minutesOfDay("00:10"))).toBe(true);
    expect(inBedtime(night, minutesOfDay("06:59"))).toBe(true);
    expect(inBedtime(night, minutesOfDay("07:00"))).toBe(false);
    const nap = { start: "13:00", end: "14:30" };
    expect(inBedtime(nap, minutesOfDay("13:45"))).toBe(true);
    expect(inBedtime(nap, minutesOfDay("14:30"))).toBe(false);
  });

  it("says when the daily time or bedtime is reached, bedtime first", () => {
    expect(controlState(controls(), at(21))).toEqual({ kind: "ok" });
    expect(controlState(controls({ daily_minutes: 30, minutes_today: 29 }), at(16))).toEqual({ kind: "ok" });
    expect(controlState(controls({ daily_minutes: 30, minutes_today: 30 }), at(16))).toEqual({ kind: "time_up", limit: 30, pause: false });
    const both = controls({ daily_minutes: 30, minutes_today: 45, bedtime: { start: "20:00", end: "07:00" }, when_reached: "pause" });
    expect(controlState(both, at(21))).toEqual({ kind: "bedtime", until: "07:00", pause: true });
    expect(controlState(both, at(18))).toEqual({ kind: "time_up", limit: 30, pause: true });
  });

  it("accepts only sensible settings", () => {
    const ok = { daily_minutes: 45, bedtime: { start: "20:00", end: "07:00" }, when_reached: "pause" };
    expect(parentalControlsInput.safeParse(ok).success).toBe(true);
    expect(parentalControlsInput.safeParse({ ...ok, daily_minutes: null, bedtime: null }).success).toBe(true);
    for (const bad of [{ daily_minutes: 0 }, { daily_minutes: 44 }, { bedtime: { start: "24:00", end: "07:00" } }, { bedtime: { start: "7:00", end: "08:00" } }, { bedtime: { start: "20:00", end: "20:00" } }, { when_reached: "lock" }]) {
      expect(parentalControlsInput.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("describes the controls in plain words", () => {
    expect(describeControls({ daily_minutes: null, bedtime: null, when_reached: "pause" })).toEqual(["No limits set."]);
    expect(describeControls({ daily_minutes: 90, bedtime: { start: "20:00", end: "07:00" }, when_reached: "remind" })).toEqual([
      "Up to 1 hour 30 minutes of lessons a day.",
      "Bedtime from 20:00 to 07:00.",
      "Then a reminder to take a break.",
    ]);
    expect(formatMinutes(60)).toBe("1 hour");
    expect(formatMinutes(15)).toBe("15 minutes");
    expect(formatMinutes(1)).toBe("1 minute");
    expect(shortMinutes(0)).toBe("0 min");
    expect(shortMinutes(95)).toBe("1 h 35 min");
    expect(shortMinutes(120)).toBe("2 h");
  });
});

const quiz = (overrides: Partial<QuizResultRow>): QuizResultRow => ({
  quiz: "Check-up",
  course: "Fractions",
  status: "submitted",
  score: 8,
  max_score: 10,
  percent: 80,
  pending_review: 0,
  question_count: 10,
  started_at: "2026-11-16T09:00:00.000Z",
  submitted_at: "2026-11-16T09:10:00.000Z",
  ...overrides,
});

describe("what parents read", () => {
  it("lists activity newest first, each lesson once", () => {
    const activity = buildActivity({
      enrollments: [{ course: "Fractions", enrolledAt: new Date("2026-11-10T10:00:00Z") }],
      lessons: [
        { course: "Fractions", lesson: "Halves", startedAt: new Date("2026-11-10T10:01:00Z"), completedAt: new Date("2026-11-11T10:00:00Z") },
        { course: "Fractions", lesson: "Quarters", startedAt: new Date("2026-11-12T10:00:00Z"), completedAt: null },
      ],
      quizzes: [quiz({ submitted_at: "2026-11-13T10:00:00.000Z" }), quiz({ quiz: "Open one", status: "in_progress", submitted_at: null })],
      badges: [{ name: "First step", earnedAt: new Date("2026-11-11T10:00:01Z") }],
      certificates: [],
    });
    expect(activity.map((item) => item.text)).toEqual([
      "Finished the quiz “Check-up”: 8 of 10 points (80%)",
      "Opened the lesson “Quarters”",
      "Earned the badge “First step”",
      "Finished the lesson “Halves”",
      "Started the course “Fractions”",
    ]);
    expect(buildActivity({ enrollments: [], lessons: [], quizzes: [], badges: [], certificates: [] })).toEqual([]);
  });

  it("points out what's going well and what to practise, by simple rules", () => {
    const insights = buildInsights({
      courses: [
        { title: "Counting", completed: true, percent: 100 },
        { title: "Fractions", completed: false, percent: 50 },
      ],
      quizzes: [quiz({ quiz: "Strong", percent: 90 }), quiz({ quiz: "Middle", percent: 70 }), quiz({ quiz: "Weak", percent: 40 }), quiz({ quiz: "Open", status: "in_progress", percent: null })],
      streak_days: 4,
      missed_review_lessons: ["Halves"],
      overdue_work: ["Homework 1"],
    });
    expect(insights.doing_well).toEqual(["Finished the course “Counting”.", "Scored 90% in the quiz “Strong”.", "Learned 4 days in a row."]);
    expect(insights.to_practise).toEqual([
      "The quiz “Weak” (40%): worth taking again.",
      "Review questions from “Halves” were missed more than once.",
      "“Homework 1” from school is overdue.",
    ]);
    expect(buildInsights({ courses: [], quizzes: [], streak_days: 2, missed_review_lessons: [], overdue_work: [] })).toEqual({ doing_well: [], to_practise: [] });
  });

  it("works out quiz percentages and averages, leaving out what isn't marked", () => {
    expect(quizPercent(5, 9)).toBe(56);
    expect(quizPercent(0, 0)).toBeNull();
    expect(quizAverage([quiz({ percent: 80 }), quiz({ percent: 50 }), quiz({ status: "in_progress", percent: null })])).toBe(65);
    expect(quizAverage([])).toBeNull();
    expect(scoreText(quiz({ max_score: 0, percent: null }))).toBe("written answers, not marked yet");
    expect(scoreText(quiz({ status: "in_progress" }))).toBe("in progress");
  });

  it("says when a child was last active, in the parent's days", () => {
    const now = new Date("2026-11-16T12:00:00Z");
    expect(lastActiveLabel(null, now)).toBe("Not active yet");
    expect(lastActiveLabel("2026-11-16T08:00:00Z", now)).toBe("Active today");
    expect(lastActiveLabel("2026-11-15T23:30:00Z", now)).toBe("Active yesterday");
    // 23:30 UTC on the 15th is already the 16th in Tokyo.
    expect(lastActiveLabel("2026-11-15T23:30:00Z", now, "Asia/Tokyo")).toBe("Active today");
    expect(lastActiveLabel("2026-11-12T10:00:00Z", now)).toBe("Active 4 days ago");
    expect(lastActiveLabel("2026-11-12T10:00:00Z", now, "Not/AZone")).toBe("Active 4 days ago");
    expect(formatDay("2026-11-16")).toBe("Nov 16, 2026");
  });
});
