import { apiFetch, type ApiFetchOptions } from "@/lib/api-client";
import type { StudentControls } from "./controls";
import {
  learnPaths,
  type Badge,
  type BookmarkCreate,
  type Certificate,
  type LessonAnnotations,
  type LessonBookmark,
  type LessonNote,
  type Notebook,
  type NoteCreate,
  type NoteResult,
  type CourseRecommendation,
  type LearningPathView,
  type ReviewAnswerRequest,
  type ReviewAnswerResult,
  type ReviewMode,
  type ReviewOverview,
  type ReviewSession,
  type StudentAssignment,
  type CourseProgress,
  type Enrollment,
  type LearningSummary,
  type LessonProgressResult,
  type LessonProgressUpdate,
  type LessonView,
  type QuizAttempt,
  type QuizAttemptSave,
  type QuizAttemptSaved,
  type QuizResult,
  type QuizSummary,
  type QuizView,
} from "./contract";

/**
 * Browser calls to the learning API (src/app/api/learn). Components never call these directly: use
 * the hooks in ./hooks.ts, which add caching, optimistic updates and invalidation. Server Components
 * use src/server/learning/service.ts instead (no HTTP hop).
 */

type RequestOptions = Omit<ApiFetchOptions, "searchParams" | "json" | "method">;

export const learnApi = {
  enrollments: (init?: RequestOptions) => apiFetch<Enrollment[]>(learnPaths.enrollments, init),
  enroll: (courseId: string) => apiFetch<Enrollment>(learnPaths.enrollments, { method: "POST", json: { course_id: courseId } }),
  unenroll: (courseId: string) => apiFetch<void>(learnPaths.enrollment(courseId), { method: "DELETE" }),
  courseProgress: (courseId: string, init?: RequestOptions) => apiFetch<CourseProgress>(learnPaths.courseProgress(courseId), init),
  /**
   * A progress report. `keepalive` lets the last report of a page (time spent, sent while the tab
   * closes) finish after the page is gone.
   */
  reportLesson: (lessonId: string, body: LessonProgressUpdate, { keepalive = false }: { keepalive?: boolean } = {}) =>
    apiFetch<LessonProgressResult>(learnPaths.lessonProgress(lessonId), { method: "PUT", json: body, keepalive }),
  summary: (init?: RequestOptions) => apiFetch<LearningSummary>(learnPaths.summary, init),
  lesson: (lessonId: string, init?: RequestOptions) => apiFetch<LessonView>(learnPaths.lesson(lessonId), init),
  badges: (init?: RequestOptions) => apiFetch<Badge[]>(learnPaths.badges, init),
  certificates: (init?: RequestOptions) => apiFetch<Certificate[]>(learnPaths.certificates, init),
  certificate: (certificateId: string, init?: RequestOptions) => apiFetch<Certificate>(learnPaths.certificate(certificateId), init),
  assignments: (init?: RequestOptions) => apiFetch<StudentAssignment[]>(learnPaths.assignments, init),
  recommendations: (init?: RequestOptions) => apiFetch<CourseRecommendation[]>(learnPaths.recommendations, init),
  path: (subject: string | undefined, init?: RequestOptions) => apiFetch<LearningPathView>(learnPaths.path, { ...init, searchParams: { subject } }),
  reviewOverview: (init?: RequestOptions) => apiFetch<ReviewOverview>(learnPaths.review, init),
  reviewSession: (mode: ReviewMode, courseId: string | undefined, init?: RequestOptions) =>
    apiFetch<ReviewSession>(learnPaths.reviewSession, { ...init, searchParams: { mode, course_id: courseId } }),
  answerReview: (itemId: string, body: ReviewAnswerRequest) => apiFetch<ReviewAnswerResult>(learnPaths.reviewAnswer(itemId), { method: "POST", json: body }),
  annotations: (lessonId: string, init?: RequestOptions) => apiFetch<LessonAnnotations>(learnPaths.annotations(lessonId), init),
  addNote: (lessonId: string, body: NoteCreate) => apiFetch<NoteResult>(learnPaths.lessonNotes(lessonId), { method: "POST", json: body }),
  editNote: (noteId: string, body: string) => apiFetch<LessonNote>(learnPaths.note(noteId), { method: "PATCH", json: { body } }),
  deleteNote: (noteId: string) => apiFetch<void>(learnPaths.note(noteId), { method: "DELETE" }),
  addBookmark: (lessonId: string, body: BookmarkCreate) => apiFetch<LessonBookmark>(learnPaths.lessonBookmarks(lessonId), { method: "POST", json: body }),
  deleteBookmark: (bookmarkId: string) => apiFetch<void>(learnPaths.bookmark(bookmarkId), { method: "DELETE" }),
  notebook: (q: string | undefined, init?: RequestOptions) => apiFetch<Notebook>(learnPaths.notebook, { ...init, searchParams: { q } }),
  courseQuizzes: (courseId: string, init?: RequestOptions) => apiFetch<QuizSummary[]>(learnPaths.courseQuizzes(courseId), init),
  quiz: (quizId: string, init?: RequestOptions) => apiFetch<QuizView>(learnPaths.quiz(quizId), init),
  startQuiz: (quizId: string) => apiFetch<QuizAttempt>(learnPaths.quizAttempts(quizId), { method: "POST" }),
  /** Autosave. `keepalive` lets the save sent while the page closes finish after it is gone. */
  saveQuizAttempt: (attemptId: string, body: QuizAttemptSave, { keepalive = false }: { keepalive?: boolean } = {}) =>
    apiFetch<QuizAttemptSaved>(learnPaths.quizAttempt(attemptId), { method: "PUT", json: body, keepalive }),
  submitQuizAttempt: (attemptId: string, body: QuizAttemptSave) => apiFetch<QuizResult>(learnPaths.quizAttemptSubmit(attemptId), { method: "POST", json: body }),
  controls: (init?: RequestOptions) => apiFetch<StudentControls>(learnPaths.controls, init),
};

/** The certificate PDF, as a plain link (the browser downloads it, or shows it with `inline`). */
export function certificatePdfUrl(certificateId: string, { inline = false }: { inline?: boolean } = {}): string {
  return `/api${learnPaths.certificatePdf(certificateId)}${inline ? "?inline=1" : ""}`;
}
