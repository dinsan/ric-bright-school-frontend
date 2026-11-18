/**
 * The student learning API contract (Phase 5): JSON shapes and paths shared by the browser
 * (./api.ts, ./hooks.ts) and the server that produces them (src/server/learning/service.ts,
 * src/app/api/learn/*). Both sides import these types, so the compiler checks both ends.
 *
 * Paths are relative to /api. Every endpoint is for signed-in students only, about themselves.
 * This module must stay free of server-only and client-only code: both bundles import it.
 */

import type { Subject } from "@/features/catalog/types";
import type { AssignmentStatus } from "./assignments";
import type { BadgeIcon } from "./badges";
import type { PathStatus } from "./path";
import type { LessonBlock } from "./blocks";
import type { QuizAnswers, QuizLayout, QuizQuestion } from "./quiz";

export type LessonStatus = "not_started" | "started" | "completed";

/** A course the student is taking, with their progress in it. GET /learn/enrollments. */
export interface Enrollment {
  course: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    grade_level: number;
    subject: Subject;
  };
  enrolled_at: string;
  completed_at: string | null;
  last_activity_at: string;
  progress: CourseProgressSummary;
}

export interface CourseProgressSummary {
  lessons_total: number;
  lessons_completed: number;
  /** 0 to 100, rounded down (100 only when every lesson is done). */
  percent: number;
  /** Where "Continue" goes: the lesson to open next, or null when the course is finished or empty. */
  next_lesson: LessonRef | null;
}

export interface LessonRef {
  id: string;
  slug: string;
  title: string;
  position: number;
}

/** GET /learn/courses/{course_id}/progress: the course outline with the student's status per lesson. */
export interface CourseProgress {
  course_id: string;
  enrolled: boolean;
  /** Why the student can't start it yet (learning path), or null. */
  locked_reason: string | null;
  lessons: Array<LessonRef & { duration_minutes: number | null; status: LessonStatus; completed_at: string | null }>;
  summary: CourseProgressSummary;
}

/**
 * PUT /learn/lessons/{lesson_id}/progress. Idempotent, so an offline queue can retry safely
 * (FE-STU-05): "completed" stays completed, time only adds up, and a repeated report is harmless.
 */
export interface LessonProgressUpdate {
  status: "started" | "completed";
  /** Seconds spent since the last report (0 to MAX_SECONDS_PER_REPORT). */
  seconds?: number;
  /** Where each video was left, in seconds ({ "<block id>": 42 }); merged into what is stored. */
  media?: Record<string, number>;
  /**
   * A random id per report (the offline queue makes one per send). A report whose id was already applied
   * is answered with the current state and not applied again, so a retry after a lost answer is harmless.
   */
  report_id?: string;
}

export interface LessonProgressResult {
  lesson_id: string;
  status: "started" | "completed";
  seconds_spent: number;
  completed_at: string | null;
  media_positions: Record<string, number>;
  /** The course is now finished (this report completed its last lesson). */
  course_completed: boolean;
  /** This report's id had already been applied: nothing changed. */
  duplicate: boolean;
  /** Earned with this report, for the celebration (FE-STU-07). */
  new_badges: Badge[];
  /** The level before and after this report: they differ on a level-up. */
  level: { before: number; after: number };
  /** Issued with this report when it finished the course. */
  certificate: Certificate | null;
}

/** GET /learn/lessons/{lesson_id}: everything the lesson player shows. */
export interface LessonView {
  course: { id: string; slug: string; title: string; grade_level: number; subject: Subject };
  lesson: { id: string; slug: string; title: string; summary: string; position: number; duration_minutes: number | null };
  /** The content. Empty until the student has started the course (`enrolled`). */
  blocks: LessonBlock[];
  enrolled: boolean;
  /** Why the course can't be started yet (learning path), or null. */
  locked_reason: string | null;
  outline: CourseProgress["lessons"];
  progress: { status: LessonStatus; seconds_spent: number; media_positions: Record<string, number> };
  previous: LessonRef | null;
  next: LessonRef | null;
}

/** GET /learn/badges: the whole shelf, earned or not. */
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  earned_at: string | null;
}

/** GET /learn/certificates, GET /learn/certificates/{id}. The PDF: GET /learn/certificates/{id}/pdf. */
export interface Certificate {
  id: string;
  /** Printed on the certificate, e.g. "LUM-7K2Q-9XHD". */
  code: string;
  student_name: string;
  course_title: string;
  subject_name: string;
  grade_level: number;
  lessons_count: number;
  issued_at: string;
  /** The course's page, while the course is still published. */
  course_slug: string | null;
}

/** GET /learn/summary: what the student dashboard shows (FE-STU-01), computed by ./analytics.ts. */
export interface LearningSummary {
  /** Consecutive days with learning, up to today (or yesterday, if today has none yet). */
  streak_days: number;
  longest_streak_days: number;
  xp: number;
  level: { level: number; xp_into_level: number; xp_for_next_level: number };
  lessons_completed: number;
  courses_completed: number;
  /** Minutes of learning in the last 7 days, today included. */
  minutes_last_7_days: number;
  /** The most recently active unfinished course, with the lesson to continue. */
  continue_learning: { course: Enrollment["course"]; lesson: LessonRef } | null;
  /** All learning time, in minutes. */
  minutes_total: number;
  badges_earned: number;
  certificates: number;
  /** Review questions due now (FE-STU-10). */
  review_due: number;
  /** The student's notes and bookmarks (FE-STU-06). */
  notes_count: number;
  bookmarks_count: number;
}

/** GET /learn/assignments: work set by the student's teachers, soonest due first (FE-STU-01). */
export interface StudentAssignment {
  id: string;
  title: string;
  instructions: string | null;
  due_at: string;
  class_name: string;
  teacher_name: string;
  course: { id: string; slug: string; title: string };
  /** One lesson, or null for the whole course. */
  lesson: LessonRef | null;
  status: AssignmentStatus;
  lessons_done: number;
  lessons_total: number;
  /** Where "Start" / "Continue" goes. */
  href: string;
}

/** GET /learn/recommendations: courses worth starting next, with the reason in words (FE-STU-01). */
export interface CourseRecommendation {
  course: { id: string; slug: string; title: string; summary: string; grade_level: number; subject: Subject };
  reason: string;
}

/** GET /learn/path?subject=…: a subject's courses in order, for this student (FE-STU-09). */
export interface LearningPathView {
  subject: Subject;
  /** Subjects with a path (published courses), for switching. */
  subjects: Subject[];
  student_grade: number | null;
  steps: Array<{
    course: { id: string; slug: string; title: string; summary: string; grade_level: number };
    status: PathStatus;
    locked_reason: string | null;
    /** Below the student's grade and not started: there for practice. */
    earlier_grade: boolean;
    lessons_done: number;
    lessons_total: number;
  }>;
}

// --- Notes and bookmarks (FE-STU-06) ---------------------------------------------------------------

export const NOTE_MAX_LENGTH = 2000;

export interface LessonNote {
  id: string;
  lesson_id: string;
  /** The block the note is about; null for the whole lesson. */
  block_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface LessonBookmark {
  id: string;
  lesson_id: string;
  /** null: the whole lesson. */
  block_id: string | null;
  /** A moment in a video block, in seconds. */
  media_seconds: number | null;
  label: string | null;
  created_at: string;
}

/** GET /learn/lessons/{lesson_id}/annotations: the student's notes and bookmarks in one lesson. */
export interface LessonAnnotations {
  notes: LessonNote[];
  bookmarks: LessonBookmark[];
}

/** POST /learn/lessons/{lesson_id}/notes. */
export interface NoteCreate {
  body: string;
  block_id?: string | null;
}

/** PATCH /learn/notes/{note_id}. */
export interface NoteUpdate {
  body: string;
}

/** A saved note, with any badge it earned (writing notes counts towards "Note taker"). */
export interface NoteResult extends LessonNote {
  new_badges: Badge[];
}

/** POST /learn/lessons/{lesson_id}/bookmarks. Nothing: the lesson; block_id: a part; + media_seconds: a video moment. */
export interface BookmarkCreate {
  block_id?: string | null;
  media_seconds?: number | null;
  label?: string | null;
}

/** Where a note or bookmark belongs, for lists outside the lesson. */
export interface AnnotationContext {
  course: { slug: string; title: string };
  lesson: { id: string; slug: string; title: string };
  /** The block in words ("Video: What is a fraction?"), or null for the whole lesson. */
  block_label: string | null;
  /** Opens the lesson at the spot (and the video at the moment). */
  href: string;
}

/** GET /learn/notebook?q=…: every note and bookmark of the student, newest first. */
export interface Notebook {
  notes: Array<LessonNote & AnnotationContext>;
  bookmarks: Array<LessonBookmark & AnnotationContext>;
}

export type ReviewMode = "review" | "practice";

/** GET /learn/review: what there is to review (FE-STU-10). */
export interface ReviewOverview {
  due_count: number;
  total_count: number;
  /** When the next question comes due, if none is due now. */
  next_due_at: string | null;
  courses: Array<{ course: { id: string; slug: string; title: string }; questions: number; due: number }>;
}

/** A question to answer in a review or practice session. The answer stays on the server. */
export interface ReviewQuestion {
  id: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  lesson: { slug: string; title: string };
  course: { slug: string; title: string };
  strength: "new" | "learning" | "known" | "mastered";
}

/** GET /learn/review/session?mode=review|practice&course_id=… */
export interface ReviewSession {
  mode: ReviewMode;
  questions: ReviewQuestion[];
}

/** POST /learn/review/{item_id}/answer. Practice answers don't change the schedule. */
export interface ReviewAnswerRequest {
  choice: string;
  mode: ReviewMode;
}

export interface ReviewAnswerResult {
  correct: boolean;
  /** The right option's id, to show after the answer. */
  answer: string;
  explanation: string | null;
  /** The schedule changed (review mode). */
  scheduled: boolean;
  next_due_at: string;
  interval_days: number;
  strength: ReviewQuestion["strength"];
}

// --- Quizzes (FE-ASM-01, FE-ASM-02) ------------------------------------------------------------------

/** A quiz in a course's list, with how the student is doing on it. GET /learn/courses/{course_id}/quizzes. */
export interface QuizSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  question_count: number;
  layout: QuizLayout;
  /** The attempt in progress: how far the student got. */
  in_progress: { answered: number; started_at: string } | null;
  /** The most recent finished attempt. */
  last_result: QuizResult | null;
}

/** An attempt being taken: what the student has answered and flagged so far. */
export interface QuizAttempt {
  id: string;
  status: "in_progress" | "submitted";
  answers: QuizAnswers;
  /** Question ids the student flagged to look at again before finishing. */
  flagged: string[];
  started_at: string;
  updated_at: string;
}

/** GET /learn/quizzes/{quiz_id}: everything the quiz player shows. */
export interface QuizView {
  course: { id: string; slug: string; title: string };
  quiz: { id: string; slug: string; title: string; description: string | null; layout: QuizLayout; question_count: number; points_total: number };
  /** The course is started: the quiz can be taken. Questions are only sent then. */
  enrolled: boolean;
  questions: QuizQuestion[];
  /** The attempt in progress, to carry on with. */
  attempt: QuizAttempt | null;
  last_result: QuizResult | null;
}

/**
 * PUT /learn/quiz-attempts/{attempt_id} (autosave) and the body of POST …/submit: the whole state each
 * time, so a retried or repeated save is harmless. Answers to questions no longer in the quiz are ignored.
 */
export interface QuizAttemptSave {
  answers: QuizAnswers;
  flagged: string[];
}

export interface QuizAttemptSaved {
  saved_at: string;
}

/** POST /learn/quiz-attempts/{attempt_id}/submit. Submitting twice answers with the same result. */
export interface QuizResult {
  attempt_id: string;
  /** Points for right answers, out of the points marked automatically. */
  score: number;
  max_score: number;
  /** Written answers, not marked automatically (not in the score), and their points. */
  pending_review: number;
  pending_points: number;
  answered: number;
  question_count: number;
  submitted_at: string;
}

/** POST /learn/enrollments. */
export interface EnrollRequest {
  course_id: string;
}

/** The most time one progress report may add: longer gaps mean the tab was left open. */
export const MAX_SECONDS_PER_REPORT = 15 * 60;

const id = (value: string) => encodeURIComponent(value);

export const learnPaths = {
  enrollments: "/learn/enrollments",
  enrollment: (courseId: string) => `/learn/enrollments/${id(courseId)}`,
  courseProgress: (courseId: string) => `/learn/courses/${id(courseId)}/progress`,
  lesson: (lessonId: string) => `/learn/lessons/${id(lessonId)}`,
  lessonProgress: (lessonId: string) => `/learn/lessons/${id(lessonId)}/progress`,
  summary: "/learn/summary",
  badges: "/learn/badges",
  certificates: "/learn/certificates",
  certificate: (certificateId: string) => `/learn/certificates/${id(certificateId)}`,
  certificatePdf: (certificateId: string) => `/learn/certificates/${id(certificateId)}/pdf`,
  assignments: "/learn/assignments",
  recommendations: "/learn/recommendations",
  path: "/learn/path",
  review: "/learn/review",
  reviewSession: "/learn/review/session",
  reviewAnswer: (itemId: string) => `/learn/review/${id(itemId)}/answer`,
  annotations: (lessonId: string) => `/learn/lessons/${id(lessonId)}/annotations`,
  lessonNotes: (lessonId: string) => `/learn/lessons/${id(lessonId)}/notes`,
  note: (noteId: string) => `/learn/notes/${id(noteId)}`,
  lessonBookmarks: (lessonId: string) => `/learn/lessons/${id(lessonId)}/bookmarks`,
  bookmark: (bookmarkId: string) => `/learn/bookmarks/${id(bookmarkId)}`,
  notebook: "/learn/notebook",
  courseQuizzes: (courseId: string) => `/learn/courses/${id(courseId)}/quizzes`,
  quiz: (quizId: string) => `/learn/quizzes/${id(quizId)}`,
  quizAttempts: (quizId: string) => `/learn/quizzes/${id(quizId)}/attempts`,
  quizAttempt: (attemptId: string) => `/learn/quiz-attempts/${id(attemptId)}`,
  quizAttemptSubmit: (attemptId: string) => `/learn/quiz-attempts/${id(attemptId)}/submit`,
  /** The learning-time controls a parent set (FE-PAR-03): StudentControls in ./controls.ts. */
  controls: "/learn/controls",
} as const;
