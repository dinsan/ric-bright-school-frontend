import { describe, expect, it } from "vitest";
import {
  addDays,
  levelForXp,
  localDay,
  minutesInLastDays,
  percentComplete,
  streaks,
  summarizeCourse,
  xpFor,
  xpToNextLevel,
  XP_RULES,
} from "@/features/learn/analytics";
import type { CourseProgress, LessonStatus } from "@/features/learn/contract";
import { withLessonStatus } from "@/features/learn/hooks";

const lessons = [
  { id: "l1", slug: "one", title: "One", position: 1 },
  { id: "l2", slug: "two", title: "Two", position: 2 },
  { id: "l3", slug: "three", title: "Three", position: 3 },
];

describe("course progress", () => {
  it("rounds down, so 100 % only means every lesson is done", () => {
    expect(percentComplete(0, 3)).toBe(0);
    expect(percentComplete(2, 3)).toBe(66);
    expect(percentComplete(299, 300)).toBe(99);
    expect(percentComplete(3, 3)).toBe(100);
    expect(percentComplete(0, 0)).toBe(0);
  });

  it("continues with the first unfinished lesson, in course order", () => {
    const summary = summarizeCourse([...lessons].reverse(), { l1: "completed" });
    expect(summary).toEqual({ lessons_total: 3, lessons_completed: 1, percent: 33, next_lesson: lessons[1] });
  });

  it("resumes the lesson last opened when it isn't finished", () => {
    const status = new Map<string, LessonStatus>([["l3", "started"]]);
    expect(summarizeCourse(lessons, status, "l3").next_lesson?.id).toBe("l3");
    // …but not when it's done: then the first unfinished one.
    expect(summarizeCourse(lessons, { l3: "completed" }, "l3").next_lesson?.id).toBe("l1");
  });

  it("has no next lesson when the course is finished or empty", () => {
    expect(summarizeCourse(lessons, { l1: "completed", l2: "completed", l3: "completed" }).next_lesson).toBeNull();
    expect(summarizeCourse([], {})).toEqual({ lessons_total: 0, lessons_completed: 0, percent: 0, next_lesson: null });
  });

  it("updates a cached course optimistically, and never un-completes a lesson", () => {
    const cached: CourseProgress = {
      course_id: "c1",
      enrolled: true,
      locked_reason: null,
      lessons: lessons.map((lesson) => ({ ...lesson, duration_minutes: 10, status: "not_started" as const, completed_at: null })),
      summary: summarizeCourse(lessons, {}),
    };
    const now = new Date("2026-03-01T10:00:00Z");
    const done = withLessonStatus(cached, "l1", "completed", now);
    expect(done.lessons[0]).toMatchObject({ status: "completed", completed_at: now.toISOString() });
    expect(done.summary).toMatchObject({ lessons_completed: 1, percent: 33, next_lesson: { id: "l2" } });
    expect(withLessonStatus(done, "l1", "started").lessons[0]!.status).toBe("completed");
  });
});

describe("days and streaks", () => {
  it("uses the student's time zone for the day, and UTC when it is missing or unknown", () => {
    const lateEvening = new Date("2026-03-01T03:30:00Z"); // 22:30 on 28 February in New York
    expect(localDay(lateEvening, "America/New_York")).toBe("2026-02-28");
    expect(localDay(lateEvening, "Asia/Tokyo")).toBe("2026-03-01");
    expect(localDay(lateEvening, null)).toBe("2026-03-01");
    expect(localDay(lateEvening, "Not/AZone")).toBe("2026-03-01");
  });

  it("moves across months and leap days", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("counts the current streak from today, or from yesterday while today is still open", () => {
    const days = ["2026-03-01", "2026-03-02", "2026-03-03"];
    expect(streaks(days, "2026-03-03").current).toBe(3);
    expect(streaks(days, "2026-03-04").current).toBe(3); // today not over yet
    expect(streaks(days, "2026-03-05").current).toBe(0); // a whole day missed
    expect(streaks([], "2026-03-05")).toEqual({ current: 0, longest: 0 });
  });

  it("finds the longest streak anywhere in the history", () => {
    const days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-02-10", "2026-03-02", "2026-03-03"];
    expect(streaks(days, "2026-03-03")).toEqual({ current: 2, longest: 4 });
  });

  it("sums whole minutes over the last 7 days, today included", () => {
    const days = [
      { day: "2026-03-07", seconds: 600 },
      { day: "2026-03-01", seconds: 119 },
      { day: "2026-02-28", seconds: 6000 }, // 8 days ago: not counted
    ];
    expect(minutesInLastDays(days, "2026-03-07")).toBe(11);
  });
});

describe("XP and levels", () => {
  it("adds up lessons and courses", () => {
    expect(xpFor({ lessonsCompleted: 3, coursesCompleted: 1 })).toBe(3 * XP_RULES.lessonCompleted + XP_RULES.courseCompleted);
  });

  it("needs 100 XP for level 2, then 50 more each level", () => {
    expect([1, 2, 3].map(xpToNextLevel)).toEqual([100, 150, 200]);
    expect(levelForXp(0)).toEqual({ level: 1, xp_into_level: 0, xp_for_next_level: 100 });
    expect(levelForXp(99).level).toBe(1);
    expect(levelForXp(100)).toEqual({ level: 2, xp_into_level: 0, xp_for_next_level: 150 });
    expect(levelForXp(260)).toEqual({ level: 3, xp_into_level: 10, xp_for_next_level: 200 });
    expect(levelForXp(-5).level).toBe(1);
  });
});
