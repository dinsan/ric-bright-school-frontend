import { describe, expect, it } from "vitest";
import { assignmentStatus, dueInfo } from "@/features/learn/assignments";
import { buildPath, lockReason, missingPrerequisites, type PathCourse } from "@/features/learn/path";
import { recommendCourses, type Candidate } from "@/features/learn/recommend";
import { describeInterval, firstReviewAt, MAX_BOX, REVIEW_INTERVALS_DAYS, scheduleReview, strengthLabel } from "@/features/learn/spaced";

// A small maths path: Fractions (4) → Decimals (5) → Ratios (6) → Pre-algebra (7).
const course = (id: string, grade: number, requires: string[] = [], title = id): Candidate => ({
  id,
  slug: id,
  title,
  grade_level: grade,
  requires,
  subject: { slug: "mathematics", name: "Mathematics" },
  popularity: 0,
});
const fractions = course("fractions", 4, [], "Fractions");
const decimals = course("decimals", 5, ["fractions"], "Decimals");
const ratios = course("ratios", 6, ["decimals"], "Ratios");
const preAlgebra = course("pre-algebra", 7, ["ratios"], "Pre-algebra");
const maths = [preAlgebra, fractions, ratios, decimals];
const byId = new Map<string, PathCourse>(maths.map((entry) => [entry.id, entry]));
const progress = (grade: number | null, completed: string[] = [], inProgress: string[] = []) => ({ completed: new Set(completed), inProgress: new Set(inProgress), studentGrade: grade });

describe("learning path: locks", () => {
  it("locks a course while a prerequisite at or above the student's grade is unfinished", () => {
    // Grade 5: Decimals needs Fractions (Grade 4, below the student's grade): treated as known.
    expect(missingPrerequisites(decimals, byId, progress(5))).toEqual([]);
    // Ratios needs Decimals (Grade 5 = the student's grade), not finished: locked.
    expect(missingPrerequisites(ratios, byId, progress(5)).map((entry) => entry.id)).toEqual(["decimals"]);
    expect(missingPrerequisites(ratios, byId, progress(5, ["decimals"]))).toEqual([]);
  });

  it("doesn't send an older student back: a Grade 9 student can start Pre-algebra", () => {
    expect(missingPrerequisites(preAlgebra, byId, progress(9))).toEqual([]);
  });

  it("without a grade, every unfinished prerequisite locks", () => {
    expect(missingPrerequisites(decimals, byId, progress(null)).map((entry) => entry.id)).toEqual(["fractions"]);
  });

  it("explains the lock in a sentence", () => {
    expect(lockReason([ratios])).toBe("Finish Ratios (Grade 6) first.");
    expect(lockReason([fractions, decimals, ratios])).toBe("Finish Fractions (Grade 4), Decimals (Grade 5) and Ratios (Grade 6) first.");
    expect(lockReason([])).toBeNull();
  });
});

describe("learning path: steps", () => {
  it("orders by grade, marks done / in progress / locked, and points at the course in progress", () => {
    const steps = buildPath(maths, byId, progress(5, ["fractions"], ["decimals"]));
    expect(steps.map((step) => [step.course.id, step.status])).toEqual([
      ["fractions", "done"],
      ["decimals", "in_progress"],
      ["ratios", "locked"],
      ["pre-algebra", "locked"],
    ]);
    expect(steps[2]!.locked_reason).toBe("Finish Decimals (Grade 5) first.");
  });

  it("without a course in progress, 'next' is the first open course at the student's grade, earlier grades are for practice", () => {
    const steps = buildPath(maths, byId, progress(5));
    expect(steps.map((step) => [step.course.id, step.status, step.earlier_grade])).toEqual([
      ["fractions", "available", true],
      ["decimals", "next", false],
      ["ratios", "locked", false],
      ["pre-algebra", "locked", false],
    ]);
  });
});

describe("recommended next courses", () => {
  const science = { ...course("plants", 5, [], "Plants"), subject: { slug: "science", name: "Science" }, popularity: 50 };
  const far = { ...course("calculus", 12, [], "Calculus"), popularity: 999 };
  const options = (completed: string[], inProgress: string[] = [], grade: number | null = 5) => ({
    byId,
    studentGrade: grade,
    enrolled: new Set(inProgress),
    completed: new Set(completed),
    activeSubjects: new Set(completed.length || inProgress.length ? ["mathematics"] : []),
  });

  it("puts the next step of the path first, with the reason", () => {
    const picks = recommendCourses([science, ratios, far, decimals, fractions], options(["decimals"]));
    expect(picks[0]).toEqual({ course: ratios, reason: "Next after Decimals" });
    // Never what's done, never far from the student's grade (however popular).
    expect(picks.map((pick) => pick.course.id)).not.toContain("decimals");
    expect(picks.map((pick) => pick.course.id)).not.toContain("calculus");
  });

  it("explains grade and subject picks, and never recommends a locked course", () => {
    const picks = recommendCourses([science, ratios, decimals], options([], ["fractions"]));
    expect(picks).toEqual([
      { course: decimals, reason: "More Mathematics" },
      { course: science, reason: "For Grade 5" },
    ]);
  });

  it("caps the list", () => {
    expect(recommendCourses([science, decimals, fractions, ratios], { ...options(["decimals"]), limit: 2 })).toHaveLength(2);
  });
});

describe("spaced review", () => {
  const now = new Date("2026-03-02T10:00:00Z");
  const days = (date: Date) => Math.round((date.getTime() - now.getTime()) / 86_400_000);

  it("moves a question up a box with every right answer, seen less and less often", () => {
    let state = { box: 0, reps: 0, lapses: 0 };
    const intervals: number[] = [];
    for (let i = 0; i < 8; i++) {
      const next = scheduleReview(state, true, now);
      intervals.push(days(next.dueAt));
      state = next;
    }
    expect(intervals).toEqual([3, 7, 14, 30, 60, 120, 120, 120]);
    expect(state).toMatchObject({ box: MAX_BOX, reps: 8, lapses: 0 });
  });

  it("sends a missed question back to the first box, seen again tomorrow", () => {
    const next = scheduleReview({ box: 4, reps: 5, lapses: 0 }, false, now);
    expect(next).toMatchObject({ box: 0, reps: 6, lapses: 1, intervalDays: 1 });
    expect(days(next.dueAt)).toBe(1);
  });

  it("first asks a finished lesson's questions the next day, and describes intervals in words", () => {
    expect(firstReviewAt(now).toISOString()).toBe("2026-03-03T10:00:00.000Z");
    expect(REVIEW_INTERVALS_DAYS.map(describeInterval)).toEqual(["tomorrow", "in 3 days", "in 7 days", "in 2 weeks", "in about a month", "in about 2 months", "in about 4 months"]);
    expect([0, 1, 3, 6].map(strengthLabel)).toEqual(["new", "learning", "known", "mastered"]);
  });
});

describe("assignments", () => {
  const now = new Date("2026-03-02T10:00:00Z");
  it("is done when every target lesson is done, in progress once started", () => {
    expect(assignmentStatus(0, 4, false)).toBe("not_started");
    expect(assignmentStatus(0, 4, true)).toBe("in_progress");
    expect(assignmentStatus(2, 4, true)).toBe("in_progress");
    expect(assignmentStatus(4, 4, true)).toBe("done");
  });

  it("reads due dates in the student's own days", () => {
    const at = (iso: string) => dueInfo(iso, "not_started", now, "UTC");
    expect(at("2026-02-28T12:00:00Z")).toMatchObject({ label: "Overdue by 2 days", tone: "overdue" });
    expect(at("2026-03-01T12:00:00Z")).toMatchObject({ label: "Was due yesterday", tone: "overdue" });
    expect(at("2026-03-02T23:00:00Z")).toMatchObject({ label: "Due today", tone: "today" });
    expect(at("2026-03-03T08:00:00Z")).toMatchObject({ label: "Due tomorrow", tone: "soon" });
    expect(at("2026-03-06T08:00:00Z")).toMatchObject({ label: "Due in 4 days (Fri, Mar 6)", tone: "soon" });
    expect(at("2026-03-20T08:00:00Z")).toMatchObject({ label: "Due Fri, Mar 20", tone: "later" });
    // Now is 23:00 on 2 March in Auckland; 12:00 UTC that day is 01:00 on the 3rd there: today in UTC, tomorrow in Auckland.
    expect(dueInfo("2026-03-02T12:00:00Z", "not_started", now, "UTC").label).toBe("Due today");
    expect(dueInfo("2026-03-02T12:00:00Z", "not_started", now, "Pacific/Auckland").label).toBe("Due tomorrow");
    expect(dueInfo("2026-03-01T12:00:00Z", "done", now, "UTC")).toMatchObject({ tone: "done", label: "Done · was due Sun, Mar 1" });
  });
});
