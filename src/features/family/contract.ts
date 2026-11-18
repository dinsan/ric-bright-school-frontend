/**
 * What parents see about their children's learning (FE-PAR-01, FE-PAR-02) and the parental controls
 * (FE-PAR-03): JSON shapes and paths shared by the browser and the server (src/server/family/progress.ts,
 * src/server/family/controls.ts). Every endpoint is for parents, about their own children only: anyone
 * else's child is "not found". Keep this module free of server-only and client-only code.
 */

import type { Child } from "@/features/auth/contract";
import type { AssignmentStatus, DueTone } from "@/features/learn/assignments";
import type { ParentalControlsSettings } from "@/features/learn/controls";

/** One child's card on the parent's dashboard. GET /me/children/overview. */
export interface ChildOverview {
  child: Child;
  /** The latest learning: a lesson opened or finished, a quiz finished, a review. Null: not yet. */
  last_active_at: string | null;
  streak_days: number;
  minutes_last_7_days: number;
  lessons_completed: number;
  courses_in_progress: number;
  courses_completed: number;
  level: number;
  /** The most recently finished quiz. */
  latest_quiz: QuizResultRow | null;
  /** Work set by teachers, not done yet: overdue, and due in the next 7 days. */
  work: { overdue: number; due_soon: number };
  controls: ParentalControlsSettings;
}

export interface QuizResultRow {
  quiz: string;
  course: string;
  status: "in_progress" | "submitted";
  score: number | null;
  max_score: number | null;
  /** Score in percent of the automatically marked points; null while in progress or with nothing marked. */
  percent: number | null;
  /** Written answers not marked automatically. */
  pending_review: number;
  question_count: number;
  started_at: string;
  submitted_at: string | null;
}

export type ActivityKind = "course_started" | "lesson_started" | "lesson_completed" | "quiz_finished" | "badge" | "certificate";

export interface ActivityItem {
  at: string;
  kind: ActivityKind;
  /** What happened, in a few words ("Finished the lesson “Equivalent fractions”"). */
  text: string;
  /** The course it happened in, if any. */
  course: string | null;
}

/** Everything on a child's page (and in the report). GET /me/children/{child_id}/progress?days=14. */
export interface ChildProgress {
  child: Child;
  generated_at: string;
  /** The period the learning-time numbers cover, in the child's days (`to` is today). */
  period: { days: number; from: string; to: string; minutes: number; active_days: number; lessons_completed: number; quizzes_finished: number };
  summary: {
    last_active_at: string | null;
    streak_days: number;
    longest_streak_days: number;
    minutes_last_7_days: number;
    minutes_total: number;
    lessons_completed: number;
    courses_completed: number;
    xp: number;
    level: number;
    badges_earned: number;
    /** Average of the latest finished attempt of each quiz, in percent; null before any quiz. */
    quiz_average_percent: number | null;
  };
  courses: Array<{
    id: string;
    title: string;
    subject: string;
    grade_level: number;
    enrolled_at: string;
    completed_at: string | null;
    last_activity_at: string;
    lessons_total: number;
    lessons_completed: number;
    percent: number;
    /** The lesson "Continue" would open. */
    next_lesson: string | null;
  }>;
  /** Newest first: the latest attempt of every quiz. */
  quizzes: QuizResultRow[];
  /** Work set by the child's teachers: not done first, soonest due first. */
  assignments: Array<{
    id: string;
    title: string;
    class_name: string;
    teacher_name: string;
    course: string;
    lesson: string | null;
    due_at: string;
    due_label: string;
    due_tone: DueTone;
    status: AssignmentStatus;
    lessons_done: number;
    lessons_total: number;
  }>;
  /** Every day of the period, oldest first, including days without learning. */
  learning_days: Array<{ day: string; minutes: number; lessons_completed: number }>;
  badges: Array<{ name: string; description: string; earned_at: string }>;
  certificates: Array<{ course: string; code: string; issued_at: string }>;
  /** Newest first, up to 25. */
  activity: ActivityItem[];
  insights: { doing_well: string[]; to_practise: string[] };
  controls: ParentalControlsSettings;
}

/** GET / PUT /me/children/{child_id}/controls. */
export interface ParentalControlsView extends ParentalControlsSettings {
  updated_at: string | null;
  /** Which parent last changed them ("you", or their name). */
  updated_by: string | null;
}

/** Periods a report can cover, in days. */
export const REPORT_PERIODS = [7, 30, 90] as const;

const id = (value: string) => encodeURIComponent(value);

export const familyPaths = {
  overview: "/me/children/overview",
  progress: (childId: string) => `/me/children/${id(childId)}/progress`,
  report: (childId: string) => `/me/children/${id(childId)}/report`,
  controls: (childId: string) => `/me/children/${id(childId)}/controls`,
} as const;
