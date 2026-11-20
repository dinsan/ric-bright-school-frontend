# Student experience: developer reference

> Moved verbatim from the README (section "Student experience (Phase 5)" and its work log). Keep the work log here up to date.

## Student experience (Phase 5)

Everything a student does in Lumina: the student area and its home screen, the lesson player (with video), notes and bookmarks, quizzes, progress that survives bad connections, the goals their parents set, recommendations, learning paths, review and practice, gamification and certificates. Build new student screens **on these pieces** rather than beside them, and add a line to the [work log](#student-experience-work-log) when you do.

**Plain-language guide for students and parents**: [`docs/student-guide.md`](student-guide.md).

**Try it**: sign in as `leo10` (`/sign-in/student`, password `lumina-demo-password`). Leo has one finished course with its certificate and a streak. Open `/courses/fractions-made-simple`, press **Start learning**, and work through the four lessons: the first has a real streaming video with captions, a quick check and a worksheet, the second an illustration. Finishing the fourth issues a certificate (dialog, then `/learn/certificates`, preview and PDF). The course's page for students (`/learn/courses/fractions-made-simple`) lists two **Quizzes**: *Fractions check-up* (one question at a time, one question of every type) and *Quick quiz: halves and quarters* (all on one page). Turn the network off in the browser's dev tools and press **Done**: the header says "Offline: saved on this device", and it is sent when you are back. Leo's home also shows the goals his parent set (an hour a week, three days a week, finish Fractions Made Simple by a day, with Pat's notes), questions to review from the course he finished, recommendations and his learning path (Pre-Algebra locked until Ratios and Rates is done). Finishing a lesson that meets a goal shows "Goal met!". The parent side of goals: [`parent-experience.md`](parent-experience.md).

### The layers at a glance

```
Browser                                                   Server
───────                                                   ──────
pages: (app)/learn/… (app shell)  (focus)/learn/… (lesson player)
components (lesson-player, video-player, lesson-blocks, …)
  ├─ hooks.ts        TanStack Query: reads, enrol/leave        src/app/api/learn/**/route.ts  (thin: auth, validate, call)
  ├─ sync/           offline-safe progress queue ──PUT──►         └─ src/server/learning/service.ts (rules, one transaction per report)
  └─ api.ts          apiFetch → /api/learn/*                           └─ Prisma: enrollments, lesson_progress, learning_days,
       contract.ts   ◄──── same types, same paths ────►                   progress_receipts, student_badges, certificates
analytics.ts · badges.ts · blocks.ts  ◄── same pure code on both sides ──►  (progress, streaks, XP, badges, content rules)
```

| File | What it is for |
| --- | --- |
| `src/features/learn/contract.ts` | The JSON shapes and paths (`learnPaths`) of `/api/learn`, shared by browser and server: change a type here and the compiler checks both ends. |
| `src/features/learn/api.ts` | `learnApi`, one function per endpoint (`apiFetch`, typed `ApiError`), and `certificatePdfUrl()`. Components use the hooks, not this. |
| `src/features/learn/hooks.ts` | `useLessonView`, `useCourseProgress`, `useEnrollments`, `useLearningSummary`, `useGoals`, `useRecommendations`, `useLearningPath`, `useReviewOverview`, `useReviewSession`, `useAnswerReview`, `useBadges`, `useCertificates`, `useEnroll`, `useUnenroll` (optimistic), and the `learnKeys` query-key factory. |
| `src/features/learn/sync/` | `progress-queue.ts`: the offline queue (pure, unit-tested). `progress-sync.tsx`: `ProgressSyncProvider`, `useProgressSync()`, `useProgressResults()`, `<SaveStatus />`. |
| `src/features/learn/blocks.ts` | Lesson content: the block types and their validation (`parseBlocks`), the embed allow-list. |
| `src/features/learn/quiz.ts` · `sync/quiz-autosave.ts` | Quizzes: the nine question types, quiz settings (layout), what the browser may see (`toQuizQuestion`), answer checks and marking (`gradeQuiz`); the autosave controller (pure, unit-tested). |
| `src/features/learn/analytics.ts` · `badges.ts` | Pure learning maths: progress, "continue", streaks, minutes, XP, levels; badge definitions and who earns what. |
| `src/features/learn/path.ts` · `recommend.ts` · `spaced.ts` | Pure rules: the learning path and its lock rule, recommended courses, spaced review. |
| `src/features/goals/` | Goals parents set: `contract.ts` (shapes, paths, limits), `rules.ts` (pure: titles, weeks, states, labels, history; shared by the student's and the parent's views), `components/goal-card.tsx` (one goal, for either side), `student-goals.tsx` (`/learn/goals`), `parent-goals.tsx`. |
| `src/features/learn/student-area.tsx` | What wraps every student page: `StudentProvider` (`useStudent()`), the progress queue, the celebrations. Used by both layouts. |
| `src/features/learn/components/` | `student-dashboard`, `lesson-player`, `notes-panel`, `notebook`, `lesson-outline`, `lesson-blocks`, `video-player`, `learning-path`, `recommendations`, `review-overview`, `practice-session`, `quiz-player`, `quiz-inputs`, `course-quizzes`, `celebration`, `gamification`, `achievements-nav`, `my-courses`, `course-home`, `certificates-list`, `certificate-view`, `start-learning`. |
| `src/server/learning/paths.ts` · `review.ts` · `notes.ts` · `quizzes.ts` · `src/server/goals/service.ts` | Learning paths and recommendations, the review queue, notes, quizzes and attempts; goals (read for `/learn/goals`, and `checkGoals` in the transactions that can meet one). |
| `src/server/learning/service.ts` · `certificate-pdf.ts` | Server rules (students only, own data only, idempotent and serialized progress, badges, certificates, billing hook `assertCanEnroll`) and the certificate PDF. |
| `src/hooks/use-visible-seconds.ts` | `useVisibleSeconds()`: time on task, counted only while the page is visible. |

### 1. Pages and the two student shells

| Page | Shell | What it is |
| --- | --- | --- |
| `/learn` | app (`(app)/learn`) | The home screen students land on: continue learning (or the goal that needs attention most), questions to review, their goals, streak, level and XP, numbers, recommended courses, the learning path, badges, recent courses, certificates, the celebrations switch |
| `/learn/courses` | app | My courses: progress bars, Start / Continue, certificate link (tab: Notes and bookmarks) |
| `/learn/notes` | app | Notes and bookmarks: every note and bookmark, searchable (`?q=`), each opening its spot in the lesson |
| `/learn/courses/{course}` | app | The course from the student's side: progress, Start / Continue, outline with statuses, its quizzes, leave the course |
| `/learn/courses/{course}/lessons/{lesson}` | focus (`(focus)/learn`) | The lesson player |
| `/learn/path` | app | Learning path per subject (`?subject=`): done, in progress, next, open, locked with the reason |
| `/learn/goals` | app | The goals their parents set: to work on, and met; each with how far along, the parent's note, past weeks and the way in |
| `/learn/review` | app | Review queue and practice, per course, with how the spacing works |
| `/learn/review/session?mode=review\|practice&course=…` | focus | One question at a time, instant feedback, the next review date in words |
| `/learn/courses/{course}/quizzes/{quiz}` | focus | The quiz player: intro, one question at a time or all on one page, navigator, flags, autosave, Finish with confirmation, result |
| `/learn/badges` | app | The whole badge shelf, earned and still to earn (Achievements) |
| `/learn/certificates` | app | Certificates: preview, download PDF, open PDF (Achievements) |
| `/help/students` (public) | site | Help for students in the help centre: every topic by category, searchable; `#help-{topic}` opens one. `/learn/help` redirects here. The **?** button opens the same help as a side panel on every student page, lessons, quizzes and review included |
| `/courses/{course}` (public) | site | **Start learning** for students, "Students: sign in to start" for visitors (`StartLearning`) |

Both student layouts check the session on the server (other roles go to their own home; signed-out visitors to sign-in and back) and wrap the page in `StudentArea`, so everything below can use `useStudent()`, `useProgressSync()` and gets the celebrations. Put a page in `(app)/learn` when it needs navigation, in `(focus)/learn` when the student should see nothing but the task. Sidebar items live in `src/config/navigation.ts`: **Home, My courses, Learning path, Goals, Review, Achievements** (six, so a child never hunts; My courses also covers `/learn/notes`, Achievements covers badges and certificates). `ready: false` hides an item until its page exists; `match: [...]` highlights an item on extra paths (Achievements covers `/learn/badges` and `/learn/certificates`, switched by `AchievementsNav`). Server Components read data with the services directly: `requirePageAuth(["student"])` gives them the same `Auth` the API routes use.

**Help.** The app shell's **?** button comes from `signed-in-app.tsx`; for the focused pages, `StudentArea` hands
`<HelpButton audience="student" />` to `HeaderActionsProvider` (`src/components/layout/header-actions.tsx`), and
`FocusShell` (quizzes, review) and the lesson player render it with `<HeaderActions />`. So every student page has
the same button and the `?` key. Topics live in `src/features/help/content/student.ts`: each names the page
patterns it is about (`pages`), so the panel starts with "Help for this page". How help works and the rules for
writing it: [`design.md`](design.md#help).

```tsx
"use client";
import { useStudent } from "@/features/learn/student-context";
export function Greeting() {
  const { firstName, gradeBand } = useStudent(); // throws outside the student area: that's a bug
  return <h1>Hi, {firstName}!</h1>;
}
```

### 2. The lesson player (FE-STU-03)

`LessonPlayer` (`components/lesson-player.tsx`), rendered with its data on the server (`lessonView()`), then kept fresh by `useLessonView`:

- **Layout**: a header (exit, course and lesson names, the save indicator, "2 of 4", course progress bar); the **outline** as a sidebar on large screens and a drawer ("Lessons in this course" button) on phones, with each lesson's status and the current one marked; the content; a sticky footer with **Previous**, **Done** / **Done, next lesson**, **Next lesson**.
- **Start**: a student who hasn't started the course sees "Start {course}?" instead of the content (the server sends no content before enrolment).
- **Progress**: opening a lesson marks it started ("Continue" comes back here); **Done** shows at once, even offline, then moves on (offline it stays, saying the progress is on the device); time on task is counted while the lesson is visible and sent with Done, every minute and when leaving; video positions are kept.
- **Accessibility**: skip link, one h1 per lesson, `aria-current` in the outline, keyboard-only works throughout, no axe violations at 360 px and 1280 px, light and dark.

### 3. Lesson content blocks

Stored as JSON in `lessons.content`, validated by `src/features/learn/blocks.ts` whenever it is read (invalid blocks are left out and logged), rendered by `components/lesson-blocks.tsx`:

| Type | Fields | Renders as |
| --- | --- | --- |
| `text` | `heading?`, `paragraphs[]`, `list?[]` | h2, paragraphs, bullets |
| `callout` | `tone` (`tip`, `remember`, `careful`), `text` | a labelled aside |
| `image` | `src`, `alt`, `width`, `height`, `caption?` | a figure (sized: no layout shift) |
| `video` | `title`, `hls?`, `mp4?`, `poster?`, `duration_seconds`, `captions[]`, `transcript?` | the video player |
| `file` | `href`, `name`, `mime`, `size_bytes`, `description?` | a download link ("PDF, 42 KB") |
| `embed` | `url` (allow-listed host), `title`, `aspect` | a sandboxed, lazy iframe |
| `check` | `prompt`, `options[]`, `answer`, `explanation?` | a quick check: instant feedback, any number of tries, not graded |

**No HTML, ever**: text is plain strings React escapes; URLs must be site paths or https; embeds only from `EMBED_HOSTS` (add a host only after checking its privacy terms for children). The seed writes content for every lesson (`scripts/seed-content.ts`): "Fractions Made Simple" by hand with every block type, the rest generated from the lesson summaries. The course editor (FE-TCH-03) must produce exactly these shapes.

### 4. The video player (FE-STU-04)

`VideoPlayer` (`components/video-player.tsx`):

- **Streaming**: HLS with several renditions (`master.m3u8`). Safari plays it natively; other browsers load **hls.js only when a lesson has a video** (separate chunk), which picks the quality for the connection and the player size. If streaming fails, it falls back to the MP4, and if that fails too it says so with **Try again** and the transcript.
- **Codecs**: the sample video has H.264 renditions (every mainstream browser) and a VP9 one, so builds without H.264 (open-source Chromium) play it too. Add both for new videos.
- **Controls**: play/pause, position slider (announces "0:12 of 0:24"), mute, speed 0.5×–2×, captions on/off (on by default when a track is marked `default`), full screen, transcript.
- **Keyboard** (player focused): Space/K play-pause, ←/→ 5 s, J/L 10 s, Home/End, 0–9 jump to 0–90 %, M mute, C captions, F full screen, `<`/`>` speed.
- **Remembers position**: reported every 10 s of playing, on pause and at the end, through the progress queue; reopening the lesson resumes there with "Carrying on from 0:42 · Start over" (not in the first or last 3 seconds).
- **Media files** live in `public/media/lessons/{lesson}/` (served as static files; the production image copies `public/`). Moving them to a CDN or object storage (BE-MEDIA) only changes the URLs in the content. How the sample was made (ffmpeg, fMP4 segments so no `.ts` files confuse TypeScript): [`docs/lesson-media.md`](lesson-media.md).

### 5. Progress sync (FE-STU-05)

Components never send progress themselves: they **record** it, and the queue makes sure it arrives.

```tsx
const sync = useProgressSync();
sync.record(lesson.id, { status: "started" });                 // opened
sync.record(lesson.id, { seconds: 42 });                        // time on task
sync.record(lesson.id, { media: { video: 12.5 } });             // where a video stopped
sync.record(lesson.id, { status: "completed", seconds: take() }); // done
sync.state; // { status: "saving" | "saved" | "offline" | "retrying" | "failed" | "idle", pending, lastError }
<SaveStatus />; // the quiet indicator in the player's header
```

- **Coalesced**: reports for a lesson merge while they wait (status only moves forward, seconds add up, positions merge).
- **Exactly once**: each send carries a `report_id`, reused for every retry of that payload; the server records applied ids (`progress_receipts`, kept 7 days) and answers a repeat without applying it again. What is recorded during a send goes in the next one.
- **Durable and per student**: kept in `localStorage` (`lumina:progress-queue`, listed in the cookie policy) under the student's id, so closing the tab loses nothing and, on a family's shared device, one child's progress is never sent under another child's session.
- **Patient**: retries back off 1 s → 30 s, pause while offline and resume on `online`; a refusal that can't get better (not enrolled any more) is dropped and shown; when the page is hidden or closed, what's left is sent with `keepalive`.
- **Server side**: `PUT /api/learn/lessons/{id}/progress` locks the enrolment row, so simultaneous reports (two tabs, a retry) apply one after another; completing a lesson counts once; finishing the last lesson completes the course and issues its certificate in the same transaction.
- **After a confirmed report**, cached learning data is refreshed (`learnKeys.all`), and `useProgressResults(listener)` lets components react (the celebrations do).

### 6. The home screen, goals and recommendations (FE-STU-01)

The dashboard (`components/student-dashboard.tsx`) puts the most useful next step first: the course in progress ("Continue learning"), or, when nothing is in progress, **the goal that needs attention most** ("Your goal", behind first, then on track), then questions to review. Each part loads on its own, so one slow request never blanks the page. Nothing is "assigned" by anyone: students choose their courses, and their parents set goals.

- **Goals** (`src/features/goals/`, `useGoals()`, `GET /api/learn/goals`): the student's active goals, what needs attention first. Each card (`GoalCard`) says its state in words (On track, Behind, Met this week, Missed), shows the progress bar and "40 of 60 minutes this week", what's left ("20 more minutes by Sunday", "Due in 2 days"), the parent's note ("Pat says: …"), the past weeks (met or not, in words), and the way in ("Keep learning", "Open the course", "Take the quiz"). Up to three on the dashboard; all on `/learn/goals`, grouped into "To work on" and "Met". Paused goals are hidden. The rules are the same for the parent's view: [`parent-experience.md`](parent-experience.md).
- **Goal met** is celebrated once: the progress report (`goals_met`, a "Goal met!" toast from `CelebrationCenter`) or the quiz result screen ("Goal met: …"). Goals refresh with the rest of the learning data after each confirmed report (`learnKeys.all`).
- **Recommended next courses** (`components/recommendations.tsx`, rules in `recommend.ts`): three courses, each with its reason, from simple rules in order of strength: the next course of a path the student finished ("Next after Decimals and Percentages"), more of a subject they take ("More Mathematics"), their grade or one step ahead ("For Grade 5"). Never a course taken, locked, or far from their grade.

### 7. Learning path (FE-STU-09)

`components/learning-path.tsx` shows one subject's courses in grade order (switch subject with the select; it's in the URL). Each course is **done**, **in progress**, **next for you**, **open** (earlier grades are marked "for practice") or **locked** with the reason in a sentence.

- **Prerequisites** are data (`course_prerequisites`, seeded as a chain per subject in `scripts/db-seed.ts`: `PATHS`).
- **The lock rule** (`path.ts`, one sentence): *a course is locked while one of its prerequisites is unfinished and at or above the student's own grade.* Earlier grades count as learned at school, so a Grade 9 student who joins today isn't sent back to Grade 7. A finished course counts even after leaving it (certificates).
- **Enforced on the server**: starting a locked course answers 409 `course_locked` with the reason; the course page and the lesson player show the reason and a link to the path instead of "Start". A course already started is never locked.

### 8. Review and practice (FE-STU-10)

Every quick check of a finished lesson becomes a **review item** (`review_items`), first due the next day. The schedule is a Leitner system (`spaced.ts`) a child can follow: a right answer moves the question to the next box, seen less often (1, 3, 7, 14, 30, 60, 120 days); a wrong answer brings it back tomorrow.

- **`/learn/review`**: questions due now, all questions per course, when the next review is, and "How review works" in plain words.
- **Review session** (`mode=review`): the due questions, one at a time in the focused shell; **Check** answers on the server (the right answer is never sent before answering); feedback with the explanation and "Next time you'll see this question in 3 days"; a question missed comes back **once more at the end** as practice; a summary ("3 of 4 right first time"). Reviewing counts as a learning day for the streak.
- **Practice session** (`mode=practice`, optionally one `course`): any questions, weakest first; answers never change the schedule.
- Questions of lessons finished before review existed, or added to a lesson later, join the queue automatically (`syncReviewItems`); a question removed from its lesson leaves it.

### 9. Notes and bookmarks (FE-STU-06)

Inside every lesson (once the course is started), two buttons at the top of the lesson player:

- **Bookmark** (the ribbon): marks the whole lesson; press again to remove it. Under a video, **Bookmark this moment (0:42)** marks the current time; bookmarked moments appear under the video as buttons that jump there.
- **Notes** (the notebook, with the count): opens a side panel. **Notes** tab: write a note (up to 2,000 characters, Ctrl+Enter saves), say what it is **About** (the whole lesson, or one part: "Video: What is a fraction?"), then edit or delete it later (delete asks first). **Bookmarks** tab: the lesson's bookmarks, with **Go there** (scrolls to the part, focuses it, and starts the video at the moment).
- **`/learn/notes`** (a tab on My courses, and a card on the home screen): every note and bookmark, newest first, searchable, grouped by course and lesson. **Open** goes back to the exact spot: the address carries the part and the moment (`…/lessons/what-is-a-fraction?t=42#block-video`), and the player scrolls, focuses and seeks there.
- **Private**: other students never see notes or bookmarks (another student's note answers 404). A parent's copy of their child's data includes them, like everything stored about the child; the privacy policy says so. Note text is plain text, never HTML, and never logged.
- **Safe to use**: a note being saved stays in the box if saving fails, with the reason; the same bookmark twice is one bookmark; a note whose part is later removed from the lesson is kept, about the lesson. Limits: 100 notes and 50 bookmarks per lesson.
- **Gamification**: the fifth note earns the **Note taker** badge (notes never give XP, so they can't be farmed).

### 10. Gamification (FE-STU-07)

- **Streak** (flame), **XP and level** (bar to the next level), **numbers** (lessons, minutes this week, courses) and the **badge shelf** (`components/gamification.tsx`), on the dashboard and `/learn/badges`. Locked badges say how to earn them.
- **Rules in one place**: XP per lesson and course in `XP_RULES`, levels in `levelForXp` (`analytics.ts`); badges and their conditions in `BADGES` (`badges.ts`). The server awards badges in the progress transaction (and when a note is written: `awardBadges` in `service.ts`, shared) and returns `new_badges` and `level: { before, after }`.
- **Celebrations** (`components/celebration.tsx`): a toast for a new badge and a level-up, a dialog for a finished course with its certificate, "+10 XP" after a lesson, a bounce on a correct quick check. **Optional** (switch on the dashboard, remembered on the device as `lumina:celebrations`) and **quieter for Grades 9–12** (`usePlayful()` is false for the high band: plain messages, no bouncing). Off, the same news still arrives, just without the fuss. Motion respects `prefers-reduced-motion`; nothing plays sound.
- **Never competitive**: no leaderboards, no comparisons with other children, nothing lost for a missed day except the streak counter.

### 11. Certificates (FE-STU-08)

- **Issued** automatically when the last lesson of a course is done, once per student and course, with a readable number (`LUM-7K2Q-9XHD`) and the names copied at that moment (a later renamed or deleted course doesn't change it). Leaving the course keeps the certificate.
- **`/learn/certificates`**: each certificate as a picture, **Preview** (large, in a dialog; on phones it keeps a readable size and scrolls sideways), **Download PDF**, **Open PDF** (`?inline=1`, also in the preview).
- **The PDF** (`GET /api/learn/certificates/{id}/pdf`) is drawn with pdf-lib on the server, A4 landscape, Lexend embedded, in the site's style; long names and titles wrap onto two lines instead of being cut. The file name carries the course, never the child's name. The on-screen preview (`certificate-view.tsx`) uses the same layout; change both together.
- **Private**: only the student sees their certificates (another student's id answers 404); there is no public verification page, because it would publish a child's name.

### 12. Quizzes (FE-ASM-01, FE-ASM-02)

A course can have quizzes (`quizzes` table: title, description, `settings`, and the questions as JSON, validated whenever read by `src/features/learn/quiz.ts`, like lesson content). They are listed on the student's course page (`components/course-quizzes.tsx`) and taken in the focused shell at `/learn/courses/{course}/quizzes/{quiz}` (`components/quiz-player.tsx`), once the course is started.

- **Configurable layout**: `settings.layout` is `one_at_a_time` (the default: one question per screen, Previous / Next, "3 of 9" in the header) or `all_on_one_page` (every question on one scrolling page). Anything invalid falls back to the default.
- **Question navigator**: every question as a numbered button: filled when answered, dashed when not, a flag when flagged, the current one ringed (never colour alone; each says it in words to screen readers). It jumps to the question (and focuses it), shows "3 of 9 answered · 1 flagged", the save status and **Finish quiz**.
- **Flag for review**: a toggle on every question ("Flag for review" / "Remove flag", with a *Flagged* badge), announced to screen readers, saved with the answers.
- **Finish with confirmation**: a dialog that says how many are answered and lists, as buttons, the questions not answered yet and the ones flagged ("Go to question 3" closes it and focuses that question). Focus starts on **Keep working**, so Enter by habit never submits unfinished work. If sending fails, the answers stay and the dialog says so.
- **Autosave** (`sync/quiz-autosave.ts`): each change is saved after a short pause, one save at a time (an older save can never land after a newer one), retried with growing pauses when the connection fails, and sent with `keepalive` when the page is hidden or left. **Finish** sends the answers with the submit too, so nothing typed in between is lost. Reloading carries on with the same attempt, at the first question not answered yet.
- **The result**: the score out of the automatically marked points, how many were answered, and how many written answers aren't marked yet. The course page shows "In progress: 3 of 9 answered" or "Last time: 7 of 8 points"; **Take the quiz again** starts a new attempt.

**Question types** (`quiz.ts`; inputs in `components/quiz-inputs.tsx`, all native controls):

| Type | Stored (author) | Student answers with | Answer value |
| --- | --- | --- | --- |
| `multiple_choice` | `options[]`, `answer` | radio cards | option id |
| `multi_select` | `options[]`, `answers[]` | checkbox cards | option ids |
| `true_false` | `answer` (boolean) | True / False radio cards | boolean |
| `short_answer` | `accepted[]`, `case_sensitive?`, `max_length?` | a text box | the text |
| `numeric` | `answer`, `tolerance?`, `unit?` | a text box with a number keyboard (`inputMode="decimal"`, not `type="number"`); "12", "2.5", "2,5", "3/4" all work | the text typed |
| `fill_blank` | `text` with `[[blank-id]]` markers, `blanks[]` (`accepted[]`) | a text box inline in the sentence per blank | blank id → text |
| `matching` | `left[]`, `right[]` (may have extra choices), `answer` (left → right) | a select per item | left id → right id |
| `ordering` | `items[]` in the right order (shown shuffled, never already right) | Move up / Move down buttons; focus follows the item, the new place is announced | item ids in order |
| `open_response` | `max_length?` | a text area with a character count | the text |

Every question has a `prompt` and `points` (default 1). **Marking** happens on the server, all or nothing per question: typed answers ignore case (unless `case_sensitive`) and extra spaces; numbers count within `tolerance`. Written answers (`open_response`) aren't marked: they are kept with the attempt and never counted in the score (nobody marks them: Lumina is self-study); the result screen asks the student to check them against the lesson. **The browser never receives an answer**: it gets `toQuizQuestion()`, the public shape. The quiz builder (FE-TCH-05) must produce exactly these shapes; the seed has one quiz of every type (`scripts/seed-quizzes.ts`).

**Attempts** (`quiz_attempts`): at most one in progress per student and quiz (started under a lock on the enrolment row, so a double click or two tabs never open two); saves replace the whole state and are refused (409 `attempt_submitted`) once it is finished; submitting marks it, stores each question's result (so a later edit of the quiz doesn't change an old result) and counts as a learning day for the streak. Submitting twice returns the same result.

### 13. The API

All under `/api/learn`, **students only** (others get 403), always about the signed-in student (the id comes from the session, never from the request):

| Method and path | Body / answer |
| --- | --- |
| `GET /api/learn/enrollments` | `Enrollment[]`: "My courses" with `progress` (`percent`, `lessons_completed`, `next_lesson`), most recently active first |
| `POST /api/learn/enrollments` | `{ course_id }` → `Enrollment`, 201 (200 if already enrolled). Published courses only |
| `DELETE /api/learn/enrollments/{course_id}` | 204; progress and certificates are kept |
| `GET /api/learn/courses/{course_id}/progress` | `CourseProgress`: each lesson's `status`, `enrolled`, the summary |
| `GET /api/learn/lessons/{lesson_id}` | `LessonView`: lesson, `blocks` (empty before enrolment), outline with statuses, previous / next, video positions |
| `PUT /api/learn/lessons/{lesson_id}/progress` | `{ status, seconds?, media?, report_id? }` → `LessonProgressResult` (`duplicate`, `course_completed`, `new_badges`, `level`, `certificate`, `goals_met`). 409 `not_enrolled` before enrolling |
| `GET /api/learn/summary` | `LearningSummary`: streak, XP, level, lessons, courses, minutes, continue learning, badges and certificates counts |
| `GET /api/learn/badges` | `Badge[]`: the whole shelf, `earned_at` or null |
| `GET /api/learn/certificates` · `/{id}` · `/{id}/pdf` | `Certificate[]`, one `Certificate`, the PDF (`?inline=1` to view in the browser) |
| `GET /api/learn/goals` | `Goal[]` (`src/features/goals/contract.ts`): the active goals their parents set, with progress, past weeks and the way in; what needs attention first |
| `GET /api/learn/recommendations` | `CourseRecommendation[]`: up to 3 courses, each with its `reason` |
| `GET /api/learn/path?subject=…` | `LearningPathView`: the subject's steps with `status`, `locked_reason`, lessons done; the subjects to switch to |
| `GET /api/learn/review` | `ReviewOverview`: due now, total, per course, when the next one is due |
| `GET /api/learn/review/session?mode=review\|practice&course_id=…` | `ReviewSession`: up to 10 questions, without answers |
| `POST /api/learn/review/{item_id}/answer` | `{ choice, mode }` → `ReviewAnswerResult`: right or not, the answer, explanation, next review (review mode only) |
| `GET /api/learn/lessons/{lesson_id}/annotations` | `LessonAnnotations`: the student's notes and bookmarks in the lesson |
| `POST /api/learn/lessons/{lesson_id}/notes` | `{ body, block_id? }` → 201 `NoteResult` (with `new_badges`). 409 `not_enrolled` before starting the course |
| `PATCH` · `DELETE /api/learn/notes/{note_id}` | `{ body }` → `LessonNote` · 204 |
| `POST /api/learn/lessons/{lesson_id}/bookmarks` | `{ block_id?, media_seconds?, label? }` → 201 `LessonBookmark` (200 when it already exists). `media_seconds` only with a video block |
| `DELETE /api/learn/bookmarks/{bookmark_id}` | 204 |
| `GET /api/learn/notebook?q=…` | `Notebook`: all notes and bookmarks with course, lesson, the part in words and a link back (`href`) |
| `GET /api/learn/courses/{course_id}/quizzes` | `QuizSummary[]`: the course's quizzes, each with the attempt in progress (`answered`) and the last result |
| `GET /api/learn/quizzes/{quiz_id}` | `QuizView`: the quiz, its questions without answers (once the course is started), the attempt in progress, the last result |
| `POST /api/learn/quizzes/{quiz_id}/attempts` | → 201 `QuizAttempt` (200 with the attempt already in progress). 409 `not_enrolled` before starting the course, `quiz_empty` without questions |
| `PUT /api/learn/quiz-attempts/{attempt_id}` | `{ answers, flagged }` (the whole state) → `{ saved_at }`. 422 with `details[].field = "body.answers.{question}"` for an answer that doesn't fit its question; 409 `attempt_submitted` once finished |
| `POST /api/learn/quiz-attempts/{attempt_id}/submit` | `{ answers?, flagged? }` → `QuizResult` (`score`, `max_score`, `pending_review`, `pending_points`, `answered`, `question_count`, `goals_met`). Again: the same result, with `goals_met: []` |

**New endpoint checklist**: type + path in `contract.ts` → service function with a zod input in `src/server/learning/service.ts` → thin route in `src/app/api/learn/` → function in `api.ts` → hook in `hooks.ts` (key in `learnKeys`) → API test in `tests/api/` (see "Adding an endpoint" in [`docs/backend.md`](backend.md)).

### 14. Data about students

| Table | One row per | Holds |
| --- | --- | --- |
| `enrollments` | student and course | enrolled, completed, last lesson opened ("Continue"), last activity |
| `lesson_progress` | student and lesson | `started` or `completed` (never goes back), seconds spent, video positions |
| `learning_days` | student and day (their time zone) | seconds spent, lessons completed: streaks and minutes |
| `progress_receipts` | applied progress report | the report id, 7 days: retries count once |
| `student_badges` | student and badge | when it was earned |
| `certificates` | student and course | the certificate, with names as they were |
| `review_items` | student and quick-check question | Leitner box, reviews, misses, when it is due |
| `learning_goals` | goal a parent set | kind, target, course or quiz, due day, the parent's note, active or paused (progress is never stored: it comes from the tables above) |
| `goal_achievements` | goal and week (or once) | when it was met, and the value that met it |
| `course_prerequisites` | course and a course it builds on | the learning paths |
| `lesson_notes` | note | the student's text, the lesson and part it is about |
| `lesson_bookmarks` | bookmark | the lesson, a part, or a video moment (`anchor` keeps each one unique) |
| `quiz_attempts` | attempt at a quiz | the answers and flags (saved as the student goes), then the mark and each question's result |

Days are aggregated on purpose: no event stream about children is stored. Deleting a child's account deletes all of it (cascade).

**Storing something new about students?** Three things in the same pull request, because the legal pages are written from the code: describe it in the privacy policy (`src/features/legal/content/privacy.tsx`, "What we collect" and "How long we keep it"), add it to the parent's data copy (`childDataCopy` in `src/server/family/service.ts`, type `ChildDataExport`), and make sure deleting the account deletes it (`onDelete: Cascade` on the student relation). New browser storage also needs a `STORAGE_KEYS` entry and a line in `src/features/legal/device-storage.ts` (a test enforces it).

### 15. Tests

| File | Covers |
| --- | --- |
| `tests/unit/learn-analytics.test.ts` | progress, "continue", days and streaks (time zones), minutes, XP and levels |
| `tests/unit/progress-queue.test.ts` | merging, report ids reused on retry, backoff, permanent failures, offline, per-student storage, keepalive, UI notifications |
| `tests/unit/lesson-content.test.ts` | block validation incl. unsafe URLs and embeds, badges, player helpers |
| `tests/components/learn.test.tsx` | student context, time on task, the lesson player (outline, content, Done, offline, start prompt, course finished), quick check, video player (controls, keyboard, resume, error), certificates, badge shelf |
| `tests/api/notes.test.ts` · `tests/components/learn-notes.test.tsx` | notes and bookmarks: writing, editing, deleting, privacy between students, validation, the Note taker badge, the notebook and its links; the panel, the header toggle, video moments, jumping, failed saves keeping the text |
| `tests/unit/learning-path.test.ts` | the lock rule and its sentence, path steps, recommendations, spaced review |
| `tests/unit/goals.test.ts` · `tests/api/goals.test.ts` | goal rules (weeks, due days, titles, states, pace, history, order); the goals API, and goals met once by progress reports (retries, concurrent reports), quizzes and reviews |
| `tests/components/learn-home.test.tsx` | navigation, the home screen with goals (the goal hero, the goals section, a parent's note, no goals, all met), `/learn/goals`, learning path, review overview, a full review session with a retry, a locked course |
| `tests/api/learning-path.test.ts` | paths and locks (incl. 409 on a locked course), recommendations, review and practice (answers hidden, scheduling, practice leaves the schedule alone, other students' questions) |
| `tests/unit/quiz.test.ts` · `tests/components/quiz.test.tsx` · `tests/api/quizzes.test.ts` | quizzes: every question type read, shown without answers and marked (numbers as typed, case and spaces, all or nothing), answer checks, the seed quizzes; autosave (debounce, one at a time, retries, keepalive order); the player in both layouts (navigator, flags, Finish dialog and its jumps, failed submit, finished elsewhere, resume) and every input; the API (no answers sent, one attempt in progress even with concurrent starts, saves, marking, idempotent submit, validation per question, privacy between students, draft courses, streak) |
| `tests/api/learning.test.ts` · `lesson-player.test.ts` | every `/api/learn` endpoint: access, enrolment, idempotent and concurrent progress, report receipts, video positions, badges, level-ups, certificates, the PDF |

### Student experience work log

Add a line for every change to the student experience (newest first), with the task id, so this section stays the place to start.

| Date | Task | What changed | Where |
| --- | --- | --- | --- |
| 2026-11-18 | SS-46 follow-up | Help moved to a **public help centre** (`/help`, `/help/students`; `/learn/help` redirects), so students can read it before signing in; the **?** button is also on the public and sign-in pages (getting-started help). The panel loads its topics in the background. Account menu **Help** → `/help/students`. | `src/features/help/`, `src/app/(marketing)/help/`, `next.config.ts` |
| 2026-11-18 | SS-46 (self-study plan) | In-app help for students: a **?** button in every student header (app shell, lesson player, quizzes, review) and the `?` key open a side panel: search ("What do you need help with?"), "Help for this page" first, 18 step-by-step topics in 5 categories naming the on-screen words in bold, each with a button to the feature (the panel closes). `/learn/help` lists everything; **Help** in the account menu opens it. Phones: the lesson player's header drops the title and the "n of m" counter (both are in the lesson heading) and, under 380 px, uses 44 px buttons, so it fits at 320 px. | `src/features/help/`, `src/components/layout/header-actions.tsx`, `student-area.tsx`, `focus-shell.tsx`, `lesson-player.tsx`, `user-menu.tsx`, `src/app/(app)/learn/help` |
| 2026-11-18 | SS-10…SS-14, SS-20…SS-23, SS-40, SS-50…SS-56 (self-study plan) | No more teachers: assigned work, classes and the teacher API are gone. Goals their parents set replace them: the home screen leads with the goal that needs attention most, a "Your goals" section and `/learn/goals` (Goals in the navigation, replacing Assignments), "Goal met!" celebrations from progress reports and on the quiz result. Picture sign-in uses the parent's family code (`/sign-in/pictures`). Written quiz answers are "not scored" (nobody marks them). | `src/features/goals/`, `src/server/goals/service.ts`, `src/app/(app)/learn/goals`, `student-dashboard.tsx`, `celebration.tsx`, `quiz-player.tsx`, `family-sign-in.tsx`; migration `…_self_study` |
| 2026-11-18 | SS-05 (self-study plan) | Students have their own sign-in: `/sign-in` asks "Who's signing in?", `/sign-in/student` only lets in student accounts (a parent's details there get "This is a parent account" and a link to the parent page), and signed-out visits to `/learn` go straight to it. Copy says "your parent" instead of "your parent or teacher". | `src/features/auth/components/portals.tsx`, `student-sign-in-form.tsx`, `src/app/(auth)/sign-in/*`, `src/server/auth/sign-in.ts` (`assertPortal`); [`auth.md`](auth.md) |
| 2026-11-16 | FE-PAR-03 (partly; student side) | Parental controls reach the student: a banner on the app-shell pages and, on lessons, quizzes and review, a one-time reminder or a break screen ("Time for a break" / "It's bedtime"), from a daily learning-time limit and a bedtime set by a parent. | `src/features/learn/controls.ts`, `components/learning-controls.tsx`, `src/app/(app)/learn/layout.tsx`, `src/app/(focus)/learn/layout.tsx`, `GET /api/learn/controls`; parent side: [`parent-experience.md`](parent-experience.md) |
| 2026-11-16 | FE-ASM-01 (partly), FE-ASM-02 (+ BE-ASM-01/03, kept small) | Quizzes: a quiz player in the focused shell, one question at a time or all on one page (per quiz), question navigator, flag for review, autosave with keepalive, Finish with a confirmation listing unanswered and flagged questions, result screen; answer inputs for nine question types (multiple choice, multi-select, true/false, short answer, numeric, fill in the blanks, matching, ordering with move buttons, open response); quizzes on the course page. Backend: `quizzes` and `quiz_attempts`, 5 endpoints, marking on the server. Seed: two quizzes in Fractions Made Simple. Privacy policy and the parent's data copy include quiz answers and marks. Checked in Chromium (keyboard, axe at 360 px and 1280 px, reload mid-quiz). | `src/features/learn/quiz.ts`, `sync/quiz-autosave.ts`, `components/quiz-player.tsx`, `quiz-inputs.tsx`, `course-quizzes.tsx`, `src/server/learning/quizzes.ts`, `src/app/api/learn/{quizzes,quiz-attempts,courses/[id]/quizzes}`, `src/app/(focus)/learn/courses/[slug]/quizzes/[quiz]`, `scripts/seed-quizzes.ts`, migration `…_quizzes` |
| 2026-11-13 | FE-STU-06 (+ BE-LRN-04), FE-STU-07/08 re-checked | Notes and bookmarks inside lessons: header bookmark toggle, notes side panel (write, about a part, edit, delete), video moments with jump buttons, `/learn/notes` (search, links back to the exact spot and moment), home-screen card, "Note taker" badge. Certificates: preview readable on phones (sideways scroll) and Open PDF in the preview. Accessibility: names built from visible content (WCAG 2.5.3), label wiring fixed. Privacy policy and the parent's data copy include notes and bookmarks. | `src/features/learn/components/notes-panel.tsx`, `notebook.tsx`, `src/server/learning/notes.ts`, `src/app/api/learn/{notes,bookmarks,notebook,lessons/[id]/…}`, migration `…_notes_bookmarks`, [`docs/student-guide.md`](student-guide.md) |
| 2026-11-13 | FE-STU-01, FE-STU-09, FE-STU-10 (+ BE-SCH-03, BE-CAT-08, BE-LRN-08 backends) | Student navigation (six items, Achievements tabs) and the home screen: continue learning or the soonest assignment, review due, work due soon, recommended courses, learning path link. Learning paths with prerequisites and an explainable lock rule (enforced on enrol). Assignments: teacher API (verified teachers, per-student completion) and student views. Review queue (Leitner spacing) and practice sessions, answers checked on the server. Privacy policy and the parent's data copy include the review schedule; teachers' view of assigned work is stated. | `src/features/learn/` (`path.ts`, `recommend.ts`, `spaced.ts`, `assignments.ts`, new components), `src/server/learning/` (`paths.ts`, `review.ts`, `assignments.ts`), `src/server/teaching/`, `src/app/api/learn/`, `src/app/api/teach/`, migration `…_learning_path_review` |
| 2026-11-13 | FE-STU-02, 03, 04, 05, 07, 08 (+ FE-STU-01 partly, FE-PUB-05 enrol) | The student lesson experience: lesson player (outline sidebar and drawer, previous / next, Done, start prompt), content blocks (text, callout, image, video, file, embed, quick check) validated server-side, HLS video player (hls.js lazy, MP4 fallback, captions, speed, keyboard, resume), offline-safe progress sync with report ids, badges, XP levels and celebrations, certificates with PDF, dashboard, My courses, course home, badges and certificates pages, Start learning on course pages. Backend: lesson content, video positions, progress receipts, badges and certificates tables; 4 new endpoints. Sample video (HLS H.264 + VP9, captions), illustration and worksheet. Privacy policy, cookie policy and the parent's data copy updated. | `src/features/learn/`, `src/server/learning/`, `src/app/api/learn/`, `src/app/(app)/learn/`, `src/app/(focus)/learn/`, `public/media/`, migration `…_lesson_player` |
| 2026-11-13 | FE-STU-00 | Foundations: student shell (`(app)/learn`, `(focus)/learn`, `useStudent`), data model (enrolments, lesson progress, learning days), `/api/learn` (5 endpoints), contract + `learnApi` + hooks with optimistic updates, learning analytics, `useVisibleSeconds`, lesson scaffold. Privacy policy and the parent's data copy now include learning progress. Fixed a production bug in `getDb()` that made concurrent page renders and API requests close each other's database client (transactions failed with P2028). | `src/features/learn/`, `src/server/learning/`, `src/app/api/learn/`, `src/app/(focus)/`, `src/server/db/index.ts` |
