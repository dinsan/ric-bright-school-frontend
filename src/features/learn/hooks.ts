"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { summarizeCourse } from "./analytics";
import type { StudentControls } from "./controls";
import { learnApi } from "./api";
import type {
  BookmarkCreate,
  CourseProgress,
  Enrollment,
  LessonAnnotations,
  LessonProgressUpdate,
  LessonStatus,
  LessonView,
  QuizAttemptSave,
  QuizSummary,
  QuizView,
  ReviewAnswerRequest,
  ReviewMode,
} from "./contract";

/**
 * TanStack Query hooks for the student experience. Every student screen reads and writes learning
 * data through these, so caching, optimistic updates and invalidation are decided once, here.
 *
 * Conventions (extend them for new student features):
 * - Keys come from `learnKeys` only; everything starts with ["learn"], so signing out (queryClient.clear)
 *   or `invalidateQueries({ queryKey: learnKeys.all })` covers all of it.
 * - A write invalidates what it changes: progress touches the course, "My courses" and the summary.
 * - Optimistic where the student would notice a delay (ticking a lesson done, leaving a course), with
 *   a rollback when the server says no.
 */

export const learnKeys = {
  all: ["learn"] as const,
  enrollments: () => [...learnKeys.all, "enrollments"] as const,
  courseProgress: (courseId: string) => [...learnKeys.all, "course-progress", courseId] as const,
  summary: () => [...learnKeys.all, "summary"] as const,
  lesson: (lessonId: string) => [...learnKeys.all, "lesson", lessonId] as const,
  badges: () => [...learnKeys.all, "badges"] as const,
  certificates: () => [...learnKeys.all, "certificates"] as const,
  assignments: () => [...learnKeys.all, "assignments"] as const,
  recommendations: () => [...learnKeys.all, "recommendations"] as const,
  path: (subject: string | undefined) => [...learnKeys.all, "path", subject ?? "default"] as const,
  reviewOverview: () => [...learnKeys.all, "review"] as const,
  reviewSession: (mode: ReviewMode, courseId: string | undefined) => [...learnKeys.all, "review-session", mode, courseId ?? "all"] as const,
  annotations: (lessonId: string) => [...learnKeys.all, "annotations", lessonId] as const,
  notebook: (q: string | undefined) => [...learnKeys.all, "notebook", q ?? ""] as const,
  courseQuizzes: (courseId: string) => [...learnKeys.all, "course-quizzes", courseId] as const,
  quiz: (quizId: string) => [...learnKeys.all, "quiz", quizId] as const,
  controls: () => [...learnKeys.all, "controls"] as const,
};

/**
 * The learning-time controls a parent set, with today's minutes (FE-PAR-03). Read on the server first;
 * refreshed every minute and after each progress report (everything under learnKeys.all is), so the
 * minutes follow the lesson being watched.
 */
export function useLearningControls(initialData: StudentControls) {
  return useQuery({
    queryKey: learnKeys.controls(),
    queryFn: ({ signal }) => learnApi.controls({ signal }),
    initialData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// --- Quizzes (FE-ASM-01, FE-ASM-02) ----------------------------------------------------------------

/** A course's quizzes with the student's progress on each. Pass null to wait. */
export function useCourseQuizzes(courseId: string | null, initialData?: QuizSummary[]) {
  return useQuery({
    queryKey: learnKeys.courseQuizzes(courseId ?? "none"),
    queryFn: ({ signal }) => learnApi.courseQuizzes(courseId!, { signal }),
    enabled: courseId !== null,
    initialData,
  });
}

/**
 * The quiz player's data, rendered first on the server. Not refetched on focus or reconnect while the
 * student is answering: the answers on screen are newer than the server's (the autosave sends them).
 */
export function useQuizView(initial: QuizView) {
  return useQuery({
    queryKey: learnKeys.quiz(initial.quiz.id),
    queryFn: ({ signal }) => learnApi.quiz(initial.quiz.id, { signal }),
    initialData: initial,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Refreshes what a quiz appears in: the course's list of quizzes, the dashboard (streak). */
function useRefreshQuizzes() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [...learnKeys.all, "course-quizzes"] }),
      queryClient.invalidateQueries({ queryKey: learnKeys.summary() }),
    ]);
}

/** Start the quiz, or carry on with the attempt in progress. */
export function useStartQuiz(quizId: string) {
  const refresh = useRefreshQuizzes();
  return useMutation({ mutationFn: () => learnApi.startQuiz(quizId), onSuccess: () => void refresh() });
}

/** Finish the attempt with its last answers. The result comes back marked. */
export function useSubmitQuiz(quizId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshQuizzes();
  return useMutation({
    mutationFn: ({ attemptId, ...body }: QuizAttemptSave & { attemptId: string }) => learnApi.submitQuizAttempt(attemptId, body),
    onSuccess: (result) => {
      queryClient.setQueryData<QuizView>(learnKeys.quiz(quizId), (data) => (data ? { ...data, attempt: null, last_result: result } : data));
      void refresh();
    },
  });
}

// --- Notes and bookmarks (FE-STU-06) ----------------------------------------------------------------

/** The student's notes and bookmarks in one lesson. Only fetched once the course is started. */
export function useAnnotations(lessonId: string, enabled = true) {
  return useQuery({ queryKey: learnKeys.annotations(lessonId), queryFn: ({ signal }) => learnApi.annotations(lessonId, { signal }), enabled });
}

/** Every note and bookmark, newest first; `q` searches. */
export function useNotebook(q: string | undefined) {
  return useQuery({ queryKey: learnKeys.notebook(q), queryFn: ({ signal }) => learnApi.notebook(q, { signal }) });
}

/** Refreshes what notes and bookmarks appear in: the lesson, the notebook, the dashboard counts. */
function useRefreshAnnotations(lessonId?: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      lessonId ? queryClient.invalidateQueries({ queryKey: learnKeys.annotations(lessonId) }) : queryClient.invalidateQueries({ queryKey: [...learnKeys.all, "annotations"] }),
      queryClient.invalidateQueries({ queryKey: [...learnKeys.all, "notebook"] }),
      queryClient.invalidateQueries({ queryKey: learnKeys.summary() }),
    ]);
}

/** Write a note. Not optimistic on purpose: the text stays in the box until the server has it. */
export function useAddNote(lessonId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAnnotations(lessonId);
  return useMutation({
    mutationFn: (body: { body: string; block_id?: string | null }) => learnApi.addNote(lessonId, body),
    onSuccess: (note) => {
      queryClient.setQueryData<LessonAnnotations>(learnKeys.annotations(lessonId), (data) => (data ? { ...data, notes: [...data.notes, note] } : data));
      void refresh();
    },
  });
}

export function useEditNote(lessonId?: string) {
  const refresh = useRefreshAnnotations(lessonId);
  return useMutation({ mutationFn: ({ noteId, body }: { noteId: string; body: string }) => learnApi.editNote(noteId, body), onSuccess: () => void refresh() });
}

/** Delete a note: gone at once, back if the server refuses. */
export function useDeleteNote(lessonId?: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAnnotations(lessonId);
  return useMutation({
    mutationFn: (noteId: string) => learnApi.deleteNote(noteId),
    onMutate: async (noteId) => {
      if (!lessonId) return {};
      await queryClient.cancelQueries({ queryKey: learnKeys.annotations(lessonId) });
      const previous = queryClient.getQueryData<LessonAnnotations>(learnKeys.annotations(lessonId));
      queryClient.setQueryData<LessonAnnotations>(learnKeys.annotations(lessonId), (data) => (data ? { ...data, notes: data.notes.filter((note) => note.id !== noteId) } : data));
      return { previous };
    },
    onError: (_error, _noteId, context) => {
      if (lessonId && context?.previous) queryClient.setQueryData(learnKeys.annotations(lessonId), context.previous);
    },
    onSettled: () => void refresh(),
  });
}

export function useAddBookmark(lessonId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAnnotations(lessonId);
  return useMutation({
    mutationFn: (body: BookmarkCreate) => learnApi.addBookmark(lessonId, body),
    onSuccess: (bookmark) => {
      queryClient.setQueryData<LessonAnnotations>(learnKeys.annotations(lessonId), (data) =>
        data && !data.bookmarks.some((entry) => entry.id === bookmark.id) ? { ...data, bookmarks: [...data.bookmarks, bookmark] } : data,
      );
      void refresh();
    },
  });
}

/** Remove a bookmark: gone at once, back if the server refuses. */
export function useDeleteBookmark(lessonId?: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAnnotations(lessonId);
  return useMutation({
    mutationFn: (bookmarkId: string) => learnApi.deleteBookmark(bookmarkId),
    onMutate: async (bookmarkId) => {
      if (!lessonId) return {};
      await queryClient.cancelQueries({ queryKey: learnKeys.annotations(lessonId) });
      const previous = queryClient.getQueryData<LessonAnnotations>(learnKeys.annotations(lessonId));
      queryClient.setQueryData<LessonAnnotations>(learnKeys.annotations(lessonId), (data) => (data ? { ...data, bookmarks: data.bookmarks.filter((entry) => entry.id !== bookmarkId) } : data));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (lessonId && context?.previous) queryClient.setQueryData(learnKeys.annotations(lessonId), context.previous);
    },
    onSettled: () => void refresh(),
  });
}

/** Work set by the student's teachers, not done first, soonest due first. */
export function useAssignments() {
  return useQuery({ queryKey: learnKeys.assignments(), queryFn: ({ signal }) => learnApi.assignments({ signal }) });
}

/** A few courses worth starting next, each with its reason. */
export function useRecommendations() {
  return useQuery({ queryKey: learnKeys.recommendations(), queryFn: ({ signal }) => learnApi.recommendations({ signal }) });
}

/** A subject's learning path (the student's last active subject when none is given). */
export function useLearningPath(subject: string | undefined) {
  return useQuery({ queryKey: learnKeys.path(subject), queryFn: ({ signal }) => learnApi.path(subject, { signal }) });
}

/** What there is to review. */
export function useReviewOverview() {
  return useQuery({ queryKey: learnKeys.reviewOverview(), queryFn: ({ signal }) => learnApi.reviewOverview({ signal }) });
}

/**
 * The questions of one review or practice session, fetched once when the session starts: answering
 * reschedules questions, so refetching mid-session would reshuffle it.
 */
export function useReviewSession(mode: ReviewMode, courseId: string | undefined) {
  return useQuery({
    queryKey: learnKeys.reviewSession(mode, courseId),
    queryFn: ({ signal }) => learnApi.reviewSession(mode, courseId, { signal }),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnReconnect: false,
  });
}

/** Answer a review question. The counts on the dashboard and the review page refresh afterwards. */
export function useAnswerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...body }: ReviewAnswerRequest & { itemId: string }) => learnApi.answerReview(itemId, body),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: learnKeys.reviewOverview() }),
        queryClient.invalidateQueries({ queryKey: learnKeys.summary() }),
      ]),
  });
}

/** "My courses", most recently active first. */
export function useEnrollments() {
  return useQuery({ queryKey: learnKeys.enrollments(), queryFn: ({ signal }) => learnApi.enrollments({ signal }) });
}

/** The dashboard numbers: streak, XP and level, minutes, "Continue learning". */
export function useLearningSummary() {
  return useQuery({ queryKey: learnKeys.summary(), queryFn: ({ signal }) => learnApi.summary({ signal }) });
}

/** A course's outline with the student's status per lesson. Pass null to wait (nothing is fetched). */
export function useCourseProgress(courseId: string | null) {
  return useQuery({
    queryKey: learnKeys.courseProgress(courseId ?? ""),
    queryFn: ({ signal }) => learnApi.courseProgress(courseId!, { signal }),
    enabled: Boolean(courseId),
  });
}

/**
 * Everything the lesson player shows. `initial` comes from the server render (the page already has it),
 * so the player paints at once and refreshes quietly.
 */
export function useLessonView(lessonId: string, initial?: LessonView) {
  return useQuery({ queryKey: learnKeys.lesson(lessonId), queryFn: ({ signal }) => learnApi.lesson(lessonId, { signal }), initialData: initial });
}

/** The badge shelf, earned and still to earn. */
export function useBadges() {
  return useQuery({ queryKey: learnKeys.badges(), queryFn: ({ signal }) => learnApi.badges({ signal }) });
}

/** Certificates earned, newest first. */
export function useCertificates() {
  return useQuery({ queryKey: learnKeys.certificates(), queryFn: ({ signal }) => learnApi.certificates({ signal }) });
}

/** The lesson view cache with one lesson's status changed (outline ticks, "done" badge), like withLessonStatus. */
export function lessonViewWithStatus(view: LessonView, lessonId: string, status: LessonStatus, now = new Date()): LessonView {
  const outline = view.outline.map((lesson) =>
    lesson.id !== lessonId || lesson.status === "completed" ? lesson : { ...lesson, status, completed_at: status === "completed" ? now.toISOString() : lesson.completed_at },
  );
  const own = view.lesson.id === lessonId && view.progress.status !== "completed" ? { ...view.progress, status } : view.progress;
  return { ...view, outline, progress: own };
}

/** Start a course. Refreshes everything the new enrolment appears in. */
export function useEnroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => learnApi.enroll(courseId),
    // The content of every lesson of the course appears once it's started: refresh all lesson views too.
    onSuccess: (_enrollment, courseId) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: learnKeys.enrollments() }),
        queryClient.invalidateQueries({ queryKey: learnKeys.courseProgress(courseId) }),
        queryClient.invalidateQueries({ queryKey: learnKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: [...learnKeys.all, "lesson"] }),
      ]),
  });
}

/** Leave a course: disappears from "My courses" at once, and comes back if the server refuses. */
export function useUnenroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => learnApi.unenroll(courseId),
    onMutate: async (courseId) => {
      await queryClient.cancelQueries({ queryKey: learnKeys.enrollments() });
      const previous = queryClient.getQueryData<Enrollment[]>(learnKeys.enrollments());
      queryClient.setQueryData<Enrollment[]>(learnKeys.enrollments(), (list) => list?.filter((entry) => entry.course.id !== courseId));
      return { previous };
    },
    onError: (_error, _courseId, context) => {
      if (context?.previous) queryClient.setQueryData(learnKeys.enrollments(), context.previous);
    },
    onSettled: (_data, _error, courseId) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: learnKeys.enrollments() }),
        queryClient.invalidateQueries({ queryKey: learnKeys.courseProgress(courseId) }),
        queryClient.invalidateQueries({ queryKey: learnKeys.summary() }),
      ]),
  });
}

/** The course progress cache with one lesson's status changed, and the summary recomputed to match. */
export function withLessonStatus(progress: CourseProgress, lessonId: string, status: LessonStatus, now = new Date()): CourseProgress {
  const lessons = progress.lessons.map((lesson) => {
    if (lesson.id !== lessonId || lesson.status === "completed") return lesson;
    return { ...lesson, status, completed_at: status === "completed" ? now.toISOString() : lesson.completed_at };
  });
  const statuses = new Map(lessons.map((lesson) => [lesson.id, lesson.status]));
  return { ...progress, lessons, summary: summarizeCourse(lessons, statuses, lessonId) };
}

/**
 * Report progress in one lesson of `courseId` (opened, time spent, done). "Done" shows at once
 * (optimistic, with the course's percent and "next lesson" recomputed by the shared analytics) and is
 * rolled back if the report fails. The server is idempotent, so retrying a report is always safe.
 */
export function useLessonProgress(courseId: string) {
  const queryClient = useQueryClient();
  const key = learnKeys.courseProgress(courseId);
  return useMutation({
    mutationFn: ({ lessonId, ...body }: LessonProgressUpdate & { lessonId: string }) => learnApi.reportLesson(lessonId, body),
    onMutate: async ({ lessonId, status }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CourseProgress>(key);
      if (previous) queryClient.setQueryData<CourseProgress>(key, withLessonStatus(previous, lessonId, status));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: learnKeys.enrollments() }),
        queryClient.invalidateQueries({ queryKey: learnKeys.summary() }),
      ]),
  });
}
