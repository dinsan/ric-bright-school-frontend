# Plan: converting Lumina into a self-study product

**Status:** the conversion is done: teachers are gone (code, data, tables, copy), students and parents sign in
separately, parents set goals, young children sign in with a family code. What's left is the next product work
(reports and notifications for parents, skill practice, content tools) and housekeeping: see [section 6](#6-execution-plan).
Decisions are recorded in [section 3](#3-decisions-needed-before-work-starts).
**Owner:** _to assign_ · **Last updated:** 2026-11-18

## 1. Goal

Lumina was built for **teachers, students and parents** working together: teachers run classes, set work, message
families and post announcements. The business requirement has changed:

| | Before | After |
| --- | --- | --- |
| **Students** | Learn what teachers assign, plus their own choice | **Study on their own**: choose courses, follow the learning path, review and practise, and work towards the goals their parent set |
| **Parents** | Watch progress, set time controls, message teachers | **Track progress, read reports and set goals** to improve their child's results, and keep the time controls |
| **Teachers** | Classes, assignments, messages, announcements, (planned) authoring and gradebook | **Removed**, with every account, page, API, table and text about them |
| **Admins** | Users, teacher verification, course prices | Users, course prices, and **content** (which teachers were going to author) |

How we know it worked:

1. No route, API, table, enum value, text or test refers to teachers, classes, assignments or parent–teacher messaging.
2. A student can go from sign-in to learning, checking, reviewing and earning a certificate with no adult involved.
3. A parent can set a goal, watch the child's progress towards it (the same numbers the child sees), get told when it
   is met or at risk, and see it in the report.
4. Everything kept still works: the test suite stays green, including the behaviour whose only tests are in files
   that are being deleted (see [section 8](#8-testing-strategy)).

---

## 2. What was checked before writing this plan

### 2.1 Baseline (2026-11-18, commit `5c05f64`)

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passes |
| `npm run lint` | Passes |
| Unit + component tests (`npm run test:unit`) | **321 passed**, 29 files |
| API tests on PostgreSQL 16 (`npm run test:api`) | **174 passed**, 17 files. Run here by applying the SQL migrations with `psql`, because the sandbox couldn't download Prisma's schema engine. Run `make test` in Docker to confirm |
| `docker compose up` / `compose.prod.yaml` | Not run (no Docker here). Already an open task: FE-FIX-02 |

All work starts from this green baseline. A test that fails later is a regression, not something that was already broken.

### 2.2 How far teachers reach into the code

**116 source, test and script files** mention teachers. The teacher features fall into five clusters:

| Cluster | Where | Notes |
| --- | --- | --- |
| **Teacher role and profile** | `UserRole.teacher`, `TeacherProfile`, `/api/me/teacher-profile`, `/api/admin/users/{id}/teacher-verification`, sign-up role choice (`src/server/auth/service.ts`, `sign-up-form.tsx`, OAuth `start` route), `roleHome`, `appNavigation.teacher` | The sign-up form offers "parent or teacher" |
| **Classes** | `Class`, `ClassMember`; **classroom picture sign-in** (`/sign-in/class`, `/api/auth/class/{code}`, `/api/auth/login/pictures`, `SessionKind.classroom`, `STORAGE_KEYS.classCode`) | **Hidden dependency:** the only way young children (Grades 1–3) sign in with pictures is through a teacher's class code. Removing classes without a replacement locks them out |
| **Assignments** | `Assignment`; `src/server/teaching/`, `/api/teach/*`, `src/server/learning/assignments.ts`, `/api/learn/assignments`, `/learn/assignments`, `assignments-list.tsx`; on the student dashboard ("Next up: assigned by…") and the parent's pages ("School work", `assignmentsOf` in `src/server/family/progress.ts`, the "overdue" insight) | The pure due-date logic in `src/features/learn/assignments.ts` (`dueInfo`, statuses in the child's own days) is **reused for goals** |
| **Messages and announcements** | `Conversation`, `Message`, `ConversationRead`, `Announcement`, `AnnouncementRead`, `MessageKind`; `src/server/messages/`, `src/features/messages/` (1,246 lines), `/api/me/{conversations,contacts,announcements,unread}`, `/family/messages*`, `/teach/*` | **Hidden dependency:** the live-update stream (`src/server/realtime/hub.ts`, `/api/me/events`, `LiveUpdatesProvider`) and the menu badges live under "messages", and their only end-to-end test is in `tests/api/messages.test.ts` |
| **Copy, legal and docs** | Privacy, safety and terms pages (`src/features/legal/content/*`), the kids' summaries, marketing "For teachers" and FAQ, `docs/teacher-guide.md`, the guides, the seed (a teacher, two classes, assignments, a conversation, an announcement) | The legal pages are written from the code, and tests check some of them |

### 2.3 What the student and parent sides already have

Most of the self-study product already exists and is kept as it is: the catalogue and search, enrolment, the lesson
player with offline-safe progress, quizzes (nine question types), learning paths with prerequisites,
recommendations, spaced review, notes and bookmarks, XP, badges and certificates, the parent overview and the child's
page, the PDF report, and parental controls (time limit and bedtime). Also there, but not yet built out:

- **Adaptive skill practice**: the tables exist (`practice_strands`, `practice_topics`, `practice_skills`,
  `practice_problems`, `practice_sessions`, `practice_answers`, `practice_skill_progress`; BE-PRA-01), but there is
  **no service, API or screen**. Without a teacher, this becomes the main thing a child does after a lesson.
- **Parent "Reports"** is already in the navigation with `ready: false` (`src/config/navigation.ts`).

### 2.4 Housekeeping found on the way

- `README.md` and `compose.yaml` refer to a `.env.example` that **does not exist**.
- `docker-compose.yml` is an older production-style stack sitting next to `compose.yaml`. Compose warns when it
  finds both and uses `compose.yaml`. It is stale and confusing.
- Files committed that shouldn't be: `__MACOSX/`, `.DS_Store`, `tsconfig.tsbuildinfo`, and `src/generated/prisma`
  (which the docs say isn't committed).
- The README was 680 lines mixing setup, feature reference and a work log. **Done as part of this plan:** it has been
  shortened and the detailed sections moved, unchanged, to `docs/` (`student-experience.md`, `parent-experience.md`,
  `messaging.md`, `formulas.md`, `api.md`, `decisions.md`, `development.md`). References in `TODO.md` and `docs/`
  were updated.

---

## 3. Decisions needed before work starts

Each decision changes the scope. Each one has a **recommended default**; if it is approved as written, the plan
below already assumes it. **D1–D6 block Phase 1.**

| # | Question | Why it matters | Recommended default |
| --- | --- | --- | --- |
| **D1** | Is Lumina live with real users? Are there real teacher accounts, classes, assignments or messages in any database? | Decides whether removal is a plain schema change or a data migration with notices, exports and retention periods | The evidence says it's **pre-launch**: hosting isn't chosen (FE-DEP-01), the legal texts are drafts, the launch plan says "soft launch with a few schools". So: no user data to migrate; the migrations are still written properly (expand, then contract) |
| **D2** | How do young children (Grades 1–3) sign in without a class? | Picture sign-in only works through a teacher's class code today | **Family code + pictures**: each parent gets a family code for a home device. The child picks their name and then their three pictures, as now. Same lockout, a session that lasts one day |
| **D3** | Who can create a student account? | Children's privacy and consent. Today only parents (or the seed) can | **Parents only** at launch (as now). Teenagers signing up themselves and then linking a parent is a later option (P2) |
| **D4** | What kinds of goal can parents set in v1? Can students set their own? | Decides the data model and the screens | Parent-set only. Kinds: **weekly learning minutes**, **weekly active days**, **weekly lessons**, **finish a course by a date**, **reach a quiz score**, and **master a skill** once practice exists. At most 5 active goals per child, each with an optional short note of encouragement. Students see their goals but can't edit them |
| **D5** | How are open-response quiz answers handled without a teacher to mark them? | `open_response` is left unmarked for a teacher today (FE-TCH-09) | **Self-check**: after submitting, the student sees a model answer and says "got it / not yet". This is never added to the score. The parent sees the answer was written, not a mark |
| **D6** | How are parents told about goals? | Notification scope and email infrastructure | **In the app** (live, using the existing SSE hub) when a goal is met or at risk, plus an **opt-in weekly email summary**. No push notifications yet |
| D7 | Who writes course content now that the teacher course studio is gone? | FE-TCH-02..05 were the only planned way to author content | For launch: content through the **seed and import scripts**, run by the team. Later: an **admin content editor** (the authoring tasks, now for admins) |
| D8 | Can parents and children message each other? | Scope. Today children never message anyone | **No.** The only message is the goal's note of encouragement, which goes one way |
| D9 | Paid courses: can a child enrol in a paid course alone? | Billing isn't built, but courses already have prices | Out of scope for the conversion. Keep the current behaviour and revisit with billing (Phase 12 of `TODO.md`). Suggest "ask a parent" for paid courses when billing arrives |
| D10 | Is adaptive skill practice (BE-PRA-02/03, FE-PRA-04) in scope? | Without teachers it is the main thing to do after a lesson; it's also needed for "master a skill" goals | **Yes, P1, mathematics first.** Needs the curriculum decision BE-PRA-02 already asks for |
| D11 | Brand and audience | The public site and FAQ speak to schools | Keep the name "Lumina". The audience becomes families (B2C). Drop the school wording and the "school license" task |

Record each answer here (date, who decided) before closing Phase 0.

| # | Answer | Date, who |
| --- | --- | --- |
| D1 | **Not live**: no users are affected by changes. Teacher data can be dropped with plain migrations; no notices or exports needed (SS-82 not needed). | 2026-11-18, product owner |
| D3 | Parents only at sign-up (the default), built in SS-05. | 2026-11-18, default applied with SS-05 |
| D2 | Family code + pictures (the default), built in SS-40. | 2026-11-18, approved with the teacher removal |
| D4 | Parent-set only; five kinds: weekly minutes, weekly active days, weekly lessons, finish a course by a day, a quiz score. "Master a skill" waits for skill practice (SS-43). At most 5 per child. | 2026-11-18, approved with the teacher removal |
| D5 | For now: written answers are "not scored" (honest copy; nobody marks them). The self-check with a model answer is still SS-41. | 2026-11-18 |
| D6 | The child's celebration ("Goal met!") is built; the parent sees goals met on their pages, in activity and in the report. In-app and email notifications for parents are SS-30 / SS-33. | 2026-11-18 |
| D8 | No messages at all: only the goal's note, parent to child. | 2026-11-18, default applied |

---

## 4. Target architecture

### 4.1 Roles

`student`, `parent`, `admin`. The `teacher` value is removed from `user_role`. `admin` covers running the platform
and managing content.

### 4.2 The two loops the product is built around

```
Student (self-study)                                       Parent (tracking and goals)
────────────────────                                       ───────────────────────────
find   catalogue · search · recommendations · learning path    set up   add child · sign-in method · family code
learn  lesson player (video, blocks, offline-safe progress)    steer    goals (new) · time controls (kept)
check  quick checks · quizzes (self-check for written answers) watch    overview · child page · Reports (new)
keep   spaced review · skill practice (new, BE-PRA)            hear     goal met / at risk (live) · weekly email (new)
grow   goals from parent (new) · streak · XP · badges · certificates
```

Both sides compute their numbers with **the same pure functions**, in the child's own days, as the parent dashboard
already does (`learningStats`, `summarizeCourse`). Goal progress follows the same rule: parent and child never see
different numbers.

### 4.3 Architecture that stays the same

One Next.js app (pages, `/api` Route Handlers, `src/server` services, Prisma on PostgreSQL); the formula engine as
the one optional service; cookie sessions; the thin route → service → Prisma layering; contract files shared by
browser and server; the LISTEN/NOTIFY → Server-Sent Events hub. The conversion **removes** a domain (teaching and
messaging) and **adds** one (goals). It does not need a new architecture.

### 4.4 Data model changes

**Removed** (contract phase, after the code that uses them is gone):

| Table or type | Note |
| --- | --- |
| `teacher_profiles` | With the admin teacher-verification endpoint and UI |
| `classes`, `class_members` | After family sign-in (D2) replaces classroom sign-in |
| `assignments` | After goals replace them on the student and parent pages |
| `conversations`, `messages`, `conversation_reads`, `announcements`, `announcement_reads`, enum `message_kind` | The realtime hub stays |
| `user_role` value `teacher` | PostgreSQL can't drop an enum value: create a new type, cast the column, drop the old one (hand-written SQL in the migration) |
| `session_kind` value `classroom` | Renamed `shared_device` (`ALTER TYPE … RENAME VALUE`), used by family sign-in |
| `User` relations | `teacherProfile`, `verifiedProfiles`, `classesTaught`, `classMemberships`, `assignmentsSet`, `conversations*`, `messagesSent`, `conversationReads`, `announcements*` |

**Added**:

```prisma
enum GoalKind   { weekly_minutes  weekly_active_days  weekly_lessons  complete_course  quiz_score  skill_mastery }
enum GoalStatus { active  paused  completed  archived }

/// A goal a parent sets for a child. Progress is never stored here: it is derived from learning_days,
/// lesson_progress, quiz_attempts and practice_skill_progress (like assignments were).
model LearningGoal {
  id, childId (→ users, cascade), createdById (→ users, set null),
  kind GoalKind, target Int,                          // minutes, days, lessons, percent, mastery
  courseId?, quizId?, skillId?,                       // what the goal is about, depending on kind
  startsOn Date, dueOn Date?,                         // weekly goals repeat from startsOn; one-off goals have dueOn
  note String? (≤ 280, plain text),                   // the parent's note of encouragement
  status GoalStatus, completedAt?, createdAt, updatedAt
  @@index([childId, status])
}

/// A goal met: once per one-off goal, once per week for weekly goals. Lets a goal be celebrated and
/// reported exactly once, and keeps the history for reports.
model GoalAchievement { goalId, periodStart Date, achievedAt, value Int   @@id([goalId, periodStart]) }
```

Also added:

- **`users.family_code`**, for parents (unique, upper-case, can be regenerated). Family sign-in lists that parent's
  children who have pictures set up.
- **`notification_preferences`**: one row per parent, holding the weekly email opt-in. The weekly email is one row in
  a new `notification_log`, so it is sent once per week.

**Every new kind of data about a child follows the existing three rules:** describe it in the privacy policy, add it
to the parent's data copy (`childDataCopy`), and cascade-delete it with the child.

### 4.5 API changes

| Remove | Add or change |
| --- | --- |
| `/api/teach/*` | `GET` · `POST /api/me/children/{id}/goals`, `PATCH` · `DELETE /api/me/children/{id}/goals/{goalId}` (edit, pause or resume, archive) |
| `/api/me/conversations/*`, `/api/me/contacts`, `/api/me/announcements/*` | `GET /api/learn/goals`: the child's goals with progress, "on track / at risk", and due labels |
| `/api/me/teacher-profile`, `/api/admin/users/{id}/teacher-verification` | `GET /api/me/notifications`, `POST …/read` (goal met or at risk), replacing `/api/me/unread` |
| `/api/learn/assignments` | `/api/me/events`: kept. Events become `goal_achieved`, `goal_at_risk`, `notification` |
| `/api/auth/class/{code}`, `/api/auth/login/pictures` (class) | `/api/auth/family/{code}` (roster) and `/api/auth/login/pictures` taking `family_code` |
| `register` role `teacher` | `register` creates parents only |
| | `GET` · `PUT /api/me/notification-preferences` |
| | Progress (`PUT /api/learn/lessons/{id}/progress`), quiz submit and practice answers check goals **in the same transaction** that awards badges, and `pg_notify` the parents |

### 4.6 Screens

| Student (`/learn`) | Parent (`/family`) | Public and auth |
| --- | --- | --- |
| Navigation: Home, My courses, Learning path, **Goals** (replaces Assignments), **Practice** (new), Review, Achievements | Navigation: Overview, My children, **Reports** (turns on the existing placeholder), no Messages | Sign-up without a role choice (parents) |
| Home: "Continue learning" → **the goal most at risk** → review due → recommendations. Nothing "assigned by" | Overview card: **goals** (met / on track / at risk) replace "School work" | `/sign-in/family` replaces `/sign-in/class` |
| `/learn/goals`: each goal, progress bar, the parent's note, "3 of 5 days this week" | `/family/children/{id}/goals`: set, edit, pause and archive goals, with a plain-words summary before saving (like the controls form) | Marketing: "For families" and "For students"; "For teachers" and the school FAQ removed |
| Quiz results: self-check for written answers (D5) | Child page: a **Goals** section; insights use goals instead of "overdue school work" | Legal: privacy, safety, terms, cookies and the kids' summaries rewritten without teachers or schools |
| A celebration when a goal is met (optional, quiet for Grades 9–12, like the others) | `/family/reports`: weekly view across children; the PDF gains a goals table; weekly email | |

---

## 5. Feature by feature

| Feature | Decision | Work |
| --- | --- | --- |
| Catalogue, search, course pages, pricing, SEO | Keep | Copy changes only |
| Lesson player, video, progress sync, notes, bookmarks | Keep | Remove "teachers never see…" wording |
| Quizzes | Adapt | Self-check for `open_response` (D5); the server-driven timer stays in FE-ASM-01 |
| Learning path, recommendations, spaced review | Keep | The dashboard order changes (4.6) |
| Skill practice (BE-PRA-02/03, FE-PRA-04) | **New** (tables exist) | Content, service and API, screens; "master a skill" goals |
| Gamification and certificates | Keep | Optional "Goal getter" badge |
| Assignments | **Replace** with goals | Reuse `dueInfo` and the status logic; delete the rest |
| Parent overview, child page, PDF report | Adapt | Goals replace school work; PDF goals table |
| Parental controls | Keep | None |
| Reports page, goal notifications, weekly email | **New** | Phase 3 |
| Parent–teacher messages and announcements | **Remove** | Keep and move the realtime hub and its test |
| Classroom picture sign-in | **Replace** with family sign-in | Phase 4 |
| Teacher role, profiles, verification | **Remove** | Phase 5 |
| Teacher studio, gradebook, question bank (planned) | **Drop / move to admin** | Authoring tasks re-scoped to admin (D7) |
| Admin users, course prices, impersonation | Keep | Remove the teacher filter and verification |
| Formula library and engine | Keep | None |

---

## 6. Execution plan

**How the work is ordered:** first **add** what replaces a teacher feature, then **switch** the screens to it, then
**remove** the teacher feature, and **drop its tables last** (expand → migrate → contract). That way every pull
request leaves a working product and a green test suite. Phase 5 (removal) can start in parallel for parts that
nothing replaces (messages, the `/teach` pages) as soon as Phase 0 is done.

Task format and rules are the ones in `TODO.md` (one task per pull request; the definition of done applies; sizes S
about half a day, M 1–2 days, L 3–5 days). IDs start with `SS-` (self-study).

### Phase 0: Preparation (before any product code)

- [ ] SS-00 · P0 · S — **Get D1–D11 decided** and write the answers into section 3 of this file.
      Done when: every decision has an answer, a date and who decided; the plan is changed wherever an answer differs from the default.
- [ ] SS-01 · P0 · S — **Confirm the baseline in Docker**: `make test` and `make check` on a fresh clone (with FE-FIX-02).
      Done when: the numbers in 2.1 are confirmed or updated, in Docker.
- [ ] SS-02 · P0 · S — **Housekeeping**: add `.env.example` (the one the README and `compose.yaml` describe); delete the stale `docker-compose.yml`; remove `__MACOSX/`, `.DS_Store` and `tsconfig.tsbuildinfo` from git; decide whether `src/generated/prisma` is committed and make the docs say so.
      Done when: `git ls-files` has none of them, and the README's instructions work word for word.
- [x] SS-03 · P0 · S — **Clean README** and move the reference sections to `docs/`.
      Done: see 2.4.
- [x] SS-05 · P0 · M — **Separate sign-in for students and parents**: each with its own page, its own kind of account, and its own side of the app.
      Done: `/sign-in` asks "Who's signing in?" (student or parent; a quiet link for staff); `/sign-in/student` (username or pictures, students only), `/sign-in/parent` (email, Google / Microsoft / Apple, parents only), `/sign-in/staff` (admins, and teacher accounts until SS-53). The server enforces it (`portalRoles` in the contract, `assertPortal`): email sign-in names its `portal`, OAuth carries it in its state, username sign-in is students only; the right password on the wrong page answers 403 `wrong_portal` with the right page, and the forms offer it. Signed-out visitors go to their area's page (`/learn` → student, `/family` → parent, `/admin` → staff; `portalForPath`), as do ended sessions. Sign-up is parents only (form, API and OAuth; a `role` sent is ignored), with copy that says children get their accounts from a parent. Home page: "For students and parents" replaces "For families and teachers"; FAQ without teachers. What each side sees was already separate (role guards on `/learn`, `/family` and their APIs) and is now checked end to end in Chromium. Tests: 7 API, 4 component, 3 unit; axe clean on every sign-in page at 360 px and 1280 px, light and dark. Docs: `docs/auth.md` (flows, rule 9), README, guides.
- [x] SS-04 · P0 · S — **Update `TODO.md`**: mark the teacher tasks `[~]` with "superseded by the self-study plan" (list in section 9), add the SS tasks, and replace "Suggested order for a first public launch".
      Done when: nobody reading `TODO.md` would pick up a teacher task.
      Done: 22 tasks marked superseded or re-scoped (Phase 7, classes, school admin, live classes, school licences, class discussions), the removed features noted, the launch order replaced, a note at the top.

### Phase 1: Goals foundation (adds only; nothing removed)

- [x] SS-10 · P0 · M — **Schema and migration**: `LearningGoal`, `GoalAchievement`, the enums, with CHECK constraints (target > 0, note ≤ 280) written into the migration SQL.
      Done when: `npm run db:check` is clean; the migration applies to the seeded database.
      Done: migration `20261118120000_self_study` (hand-written; the Prisma schema engine couldn't be downloaded where it was written): `learning_goals`, `goal_achievements`, `goal_kind`, `goal_status`, CHECKs for each kind's target range and fields, note not blank. Checked against `schema.prisma` with a script that compares tables, columns, nullability, enums and every named constraint and index (run `npm run db:check` once in Docker to confirm with Prisma itself).
- [x] SS-11 · P0 · M — **Pure goal rules** in `src/features/goals/` (`progress.ts`): progress, on track / at risk ("needs 40 min in 2 days"), the week in the child's own days (reusing `localDay` and `dueInfo`), a due label for each kind.
      Done when: unit tests cover every kind, time zones, the week boundary, pausing, and a goal met twice in one week (counted once).
      Done: `src/features/goals/rules.ts` (pure; no `progress.ts`): titles, Monday-to-Sunday weeks in the child's days, states (met, on track, behind by the even pace, missed, paused), labels and hints, due labels, whole past weeks, ordering. `tests/unit/goals.test.ts`.
- [x] SS-12 · P0 · M — **Service, API and contract**: `src/server/goals/`, `src/features/goals/contract.ts`, the parent endpoints (4.5) and `GET /api/learn/goals`. Checks: only the child's own guardians; at most 5 active goals; course, quiz or skill must exist and be published; quiz belongs to the course.
      Done when: API tests cover access both ways, someone else's child (404), validation to the field (`details[].field`), and limits.
      Done: `src/server/goals/service.ts`, `src/features/goals/contract.ts`, `/api/me/children/{id}/goals` (GET, POST), `/goals/{goal_id}` (PATCH, DELETE), `/goals/options`, `/api/learn/goals`. Any guardian of the child; at most 5 goals (active and paused), one of each kind per course or quiz, both checked under a lock on the child's row. `tests/api/goals.test.ts`.
- [x] SS-13 · P0 · M — **Achievements in the transactions**: the lesson progress report, quiz submit (and practice answers, with SS-43) record `GoalAchievement` once and send `pg_notify` to the child's parents; results return `goals_met` the way they return `new_badges`.
      Done when: API tests show a retried or concurrent report counts once, and the event reaches a parent's stream (port the stream test from `tests/api/messages.test.ts` here first; see section 8).
      Done: `checkGoals` in the lesson progress transaction and the quiz submit transaction, and after a review answer; `goals_met` in `LessonProgressResult` and in the submit's `QuizResult`. `INSERT … ON CONFLICT DO NOTHING RETURNING` makes "met" happen once (tests with retried and concurrent reports). **Not done:** `pg_notify` to parents, because the live-update hub was removed with messages (it had no other user); parent notifications are SS-30.
- [x] SS-14 · P0 · S — **Privacy rules for goals**: privacy policy ("What we collect", "How long we keep it"), `childDataCopy` (`ChildDataExport`), cascade delete.
      Done when: the data copy test includes goals and achievements; deleting a child deletes them.
      Done: privacy policy (what we collect, why, how long), `childDataCopy` (`learning.goals` with each time met), cascade delete (tested).

### Phase 2: Goals on screen (switches student and parent pages from assignments to goals)

- [x] SS-20 · P0 · M — **Parent goal screens**: `/family/children/{id}/goals` (list, set, edit, pause, archive; a plain-words summary before saving; the four states), and goals on the child's page.
      Done when: component tests cover every form state; checked with axe at 360 px and 1280 px.
      Done: `/family/children/{id}/goals` (`ParentGoals`): the list with pause / resume / remove (with a confirmation), and **Set a new goal** with a "(name) will see: …" summary, field errors from the server and the limit; a Goals tab; goals on the child's progress page. Editing the target, day or note is in the API (PATCH) but not on screen yet.
- [x] SS-21 · P0 · M — **Overview card and insights**: goals replace "School work" on `/family` cards; `insights.ts` uses goals at risk instead of overdue school work.
      Done when: the parent dashboard API test compares goal numbers with the child's `/api/learn/goals`.
      Done: the card's goal counts (met, on track, behind, missed) replace "School work"; insights use goals met, behind and missed; activity lists goals met.
- [x] SS-22 · P0 · M — **Student goals**: `/learn/goals`, a Goals item in the navigation (replacing Assignments), a dashboard card, and a celebration when a goal is met (optional, calm for Grades 9–12).
      Done when: component tests cover the dashboard order with and without goals; there are no "assigned by" strings on student pages.
      Done: `/learn/goals`, Goals in the student navigation (replacing Assignments), the dashboard leads with the goal that needs attention most and shows up to three goals, "Goal met!" from `CelebrationCenter` and on the quiz result.
- [x] SS-23 · P0 · S — **Turn off the assignment screens**: remove `/learn/assignments`, `assignments-list.tsx`, the dashboard's assignment slot and the parent's "School work". The table stays until SS-55.
      Done when: `grep -ri assign src/features src/app` only finds the pure helpers that goals reuse (moved to `src/features/goals/`).
      Done: assignments removed everywhere (screens, API, server, pure helpers).

### Phase 3: Reports and notifications for parents

- [ ] SS-30 · P1 · M — **Parent notifications**: `/api/me/notifications` (met, at risk), the bell or menu badge using the existing SSE client (`LiveUpdatesProvider` moved out of `features/messages` to `features/live`), turned on for parents only.
      Done when: a goal met on the child's device appears on the parent's open page live, or within 20 s by polling if the stream is down.
- [ ] SS-31 · P1 · M — **`/family/reports`**: all children, this week and last week, goals met and missed, time, lessons, quiz averages, skills mastered; switch the navigation placeholder on.
      Done when: the numbers match the child's page (API test); it works without JavaScript for the period picker.
- [x] SS-32 · P1 · S — **PDF report**: a goals section (goal, target, result per week or the final result) in `report-pdf.ts`.
      Done when: the PDF test includes goals across several pages.
      Done: a **Goals** table (goal, now, state, times met) replaces "Work set by teachers" in `report-pdf.ts`.
- [ ] SS-33 · P1 · M — **Weekly email summary** (opt-in, `notification_preferences`, sent once per week per parent). Decide how it is triggered (a cron calling a protected endpoint, or a job at server start) and record it in `docs/backend.md`.
      Done when: sending twice in the same week sends one email (test with the memory mail transport); unsubscribe works from the email.
- [ ] SS-34 · P2 · S — **Parental controls follow-up**: count quiz, review and practice time towards learning time (a FE-PAR-03 gap), because weekly-minutes goals rely on the same number.

### Phase 4: A student loop with no teacher

- [x] SS-40 · P0 · M — **Family sign-in** (D2): `users.family_code` (make and regenerate it under My children), `/sign-in/family`, roster and picture sign-in by family code, `SessionKind.shared_device`, storage key `lumina:family-code` (with its line in `device-storage.ts`).
      Done when: the seeded young child signs in with the family code and pictures; the lockout, rate limits and one-day session behave as the classroom ones did (ported tests).
      Done: `users.family_code` (made and replaced under My children: `FamilyCodeCard`, `GET` / `POST /api/me/family-code`), `/sign-in/pictures` (not `/sign-in/family`) with `FamilySignIn`, `GET /api/auth/family/{code}`, picture sign-in by family code, `SessionKind.shared_device`, `lumina:family-code` with its line in the cookie policy.
- [ ] SS-41 · P0 · S — **Written answers without a teacher** (D5): show a model answer after submitting (a `model_answer` field on `open_response`), ask for a self-check, store it with the attempt, keep it out of the score.
      Done when: quiz unit, component and API tests cover it; the result screen never says "waiting for your teacher".
- [ ] SS-42 · P1 · L — **Practice content** (BE-PRA-02): curriculum decision, mathematics strands, topics for Grades 1–12, skills, and a starter problem bank in the seed; link the formulas to skills (`formula_skills`).
- [ ] SS-43 · P1 · L — **Practice service and API** (BE-PRA-03), including `skill_mastery` goal checks, the data copy and learning time.
- [ ] SS-44 · P1 · L — **Practice screens** (FE-PRA-04, FE-ASM-06): subject → grade → topic → skill, a session with hints and feedback, mastery; a Practice item in the student navigation.
- [ ] SS-45 · P2 · M — **Where to start** (optional): a short placement check per subject that suggests a starting course on the learning path, for children without a grade history.
- [x] SS-46 · P1 · M — **Help for the whole product** (no teacher to ask any more): a **?** button on every page from the first one (public, sign-in, student, parent, staff), help for the page you're on, search, step-by-step topics written for each audience, and a public help centre.
      Done when: each audience only ever sees its own topics; every link and page in the help exists (unit test); keyboard, screen reader and axe checks pass at 320 px, 360 px and 1280 px.
      Done: `src/features/help/` (topics, search, `HelpButton` side panel, `HelpPage`), 18 student and 14 parent topics, `/learn/help` and `/family/help` (also **Help** in the account menu), the `?` key; the button also sits in the lesson player, quizzes and review (`HeaderActions`). Admins get none. The lesson player's header was made to fit at 320 px, and the parent top bar at 360 px (the theme button moves to **Display settings** on phones). Tests: 11 unit, 11 component; axe finds nothing on 36 help views (both roles, 360 px and 1280 px, light and dark); no sideways scrolling on 32 student and parent pages at 320 px and 360 px.
      Follow-up (help for the whole product, from the first page): help became a **public help centre**: `/help` (search all help, a card per audience, common questions) and `/help/{getting-started,students,parents,staff}`, static; `/learn/help` and `/family/help` redirect there. Two new sets of topics: **Getting started** (17: what Lumina is, finding courses, the sample lesson, search, formulas, prices, which sign-in page, creating a parent account, children's accounts, student and picture sign-in, forgotten passwords, two-step codes, safety, display, shortcuts, contact) and **Staff** (10: users, roles, turning accounts off, two-step resets, viewing as someone, sign-in problems, course prices, what is recorded, account security). The **?** button is now also on the home page and every public page (after **Search**), the sign-in pages and the admin area; on public pages its search covers all help. Topics load in the background after the page. The footer's "Help centre" replaces the `SITE_HELP_URL` link (FE-PUB-10). Tests: 22 unit, 16 component, the sitemap API test; axe finds nothing on 108 more views (public, sign-in and help pages, admin; 320, 360 and 1280 px; light and dark). How help works and the writing rules: [`design.md`](design.md#help).

### Phase 5: Remove teachers (code first, tables last)

- [x] SS-50 · P0 · S — **Close the way in**: sign-up creates parents only (no role choice, including OAuth `start`); remove "For teachers" and the school FAQ; remove the teacher navigation and `roleHome.teacher` (and teacher demo layouts in `/design`).
      Done when: nothing public links to a teacher page.
      Done: sign-up makes parents only (form, API, OAuth); "For teachers" and the school FAQ are gone; no teacher navigation, `roleHome.teacher` or teacher demo in `/design`; the staff portal is admins only.
      Partly done with SS-05: sign-up (form, API, OAuth) makes parents only; "For teachers" and the teacher FAQ are gone from the home page. Still needed: the teacher navigation, `roleHome.teacher`, the `/design` demos, and the staff portal's teacher allowance (`portalRoles.staff`).
- [x] SS-51 · P0 · M — **Remove messages and announcements**: `src/server/messages/`, `src/features/messages/` (except the SSE client moved in SS-30), `/api/me/{conversations,contacts,announcements,unread}`, `/family/messages*`, the menu badge for messages, `docs/messaging.md`.
      Done when: the hub's end-to-end test lives in the goals tests and passes; `tests/*/messages.test.*` are deleted.
      Done: all of it, and the live-update hub with it (`src/server/realtime/`, `/api/me/events`, `LiveUpdatesProvider`, the nav count badges): with messages gone it had no user. SS-30 brings live updates back if notifications need them (git history has the hub).
- [x] SS-52 · P0 · S — **Remove teaching**: `src/server/teaching/`, `src/features/teach/`, `/api/teach/*`, `src/app/(app)/teach/`, `src/server/learning/assignments.ts`, `/api/learn/assignments`.
      Done: all of it.
- [x] SS-53 · P0 · S — **Remove teacher accounts**: `/api/me/teacher-profile`, the teacher section on `/account`, admin teacher verification (route, UI, audit action names), the teacher filter in the admin user list.
      Done: all of it.
- [x] SS-54 · P0 · S — **Remove classroom sign-in** (after SS-40): `/sign-in/class`, `/api/auth/class/*`, the class code in pictures sign-in, `STORAGE_KEYS.classCode` and its legal line.
      Done: `/sign-in/class`, `/api/auth/class/*`, `class_code`, `STORAGE_KEYS.classCode` and its legal line replaced by the family code (SS-40).
- [x] SS-55 · P0 · M — **Contract migration**: drop the tables and the enum in 4.4 (hand-written enum SQL), rename `classroom` to `shared_device`, clean up the `User` relations; the seed without a teacher, classes, assignments or messages; `childDataCopy` without classes and messages.
      Done when: `npm run db:check` is clean; migrating the previous seeded database works; `make reset` works from empty; `grep -rniE 'teacher|class_?code|announcement|assignment' src scripts prisma/schema.prisma` finds nothing except deliberate history (old migrations).
      Done: in `20261118120000_self_study`: tables and `message_kind` dropped, teacher accounts deleted, `user_role` rebuilt without `teacher`, `classroom` renamed `shared_device`; applied to an empty database and to one with teacher data (accounts, classes, assignments, messages, a classroom session: all gone or converted, courses kept without their author). The seed has no teacher, classes, assignments or messages; it sets Pat's family code (SUNNY7) and three goals for Leo, and is idempotent.
- [x] SS-56 · P0 · M — **Tests**: delete the teacher-only tests; rewrite the mixed ones (`auth`, `account`, `admin`, `family`, `parent-dashboard`, `learning-path`, `notes`, `oauth`, `learn-home`, `parent`, `tests/support/factories.ts`, `tests/support/quiz.ts`) without teachers; keep the behaviour they checked for students and parents.
      Done when: the suite is green, and every behaviour that is kept still has a test (checked against the list in section 8).
      Done: teacher-only tests deleted; the mixed ones rewritten; new: `tests/api/goals.test.ts`, `tests/unit/goals.test.ts`, family-code API and component tests, goals in the parent and learn-home component tests, parent and child goals compared in `parent-dashboard.test.ts`. Totals: 330 unit and component tests, 184 API tests (baseline was 321 and 174), all passing; type-check, lint, contrast check and production build pass. Checked in Chromium on the production build: a parent sets a goal through the form, the child meets it by finishing a lesson ("Goal met!"), the parent sees it met (card, goals, insights, activity, PDF); Maya signs in with the family code; axe finds nothing on 104 page views (every changed page, each role, 360 px and 1280 px, light and dark). Found on the way, not caused by this change: under `next dev` only, concurrent page and API requests can close each other's database client (TODO BE-APP-11).

### Phase 6: Content without teachers

- [ ] SS-60 · P1 · M — **Content pipeline for launch** (D7): a documented, idempotent import for courses, lessons, quizzes and practice problems (from JSON, validated with `blocks.ts` and `quiz.ts`, like the formula seed), run by the team.
- [ ] SS-61 · P2 · XL — **Admin content editor**: the old FE-TCH-02..05 (course studio, block editor, media library, question bank), re-scoped to admins. Split before starting.

### Phase 7: Words: public site, legal and docs

- [x] SS-70 · P0 · M — **Legal texts**: privacy (teachers and schools out; goals, notifications and family code in), safety (no teacher verification promise), terms, cookies, the kids' summaries; `src/config/legal.ts`. Stays a draft until the legal review (FE-PUB-04).
      Done when: the legal tests pass; no page mentions teachers or schools as users.
      Done: privacy (goals, family code in; teachers, schools, messages out), safety (separate sign-in, family code tips; no teacher section), terms, cookie policy (the family code key), kids' summaries, `src/config/legal.ts`. Still a draft until the legal review (FE-PUB-04).
- [x] SS-71 · P0 · S — **Public site copy**: home sections ("How it works" for self-study), FAQ, pricing copy, metadata and JSON-LD descriptions.
      Done: home ("For students and parents"), FAQ, safety strip, pricing, contact, site description (metadata and JSON-LD).
- [x] SS-72 · P0 · S — **Guides and docs**: rewrite `docs/student-guide.md` and `docs/parent-guide.md` (goals, reports, family sign-in); delete `docs/teacher-guide.md`; update `docs/auth.md`, `docs/backend.md`, `docs/api.md`, `docs/student-experience.md` (and its work log), `docs/parent-experience.md`, the README (remove the "transition" notes).
      Done: both guides rewritten (goals, family code, separate sign-in); `teacher-guide.md` and `messaging.md` deleted; `auth.md`, `backend.md`, `api.md`, `decisions.md`, `design.md`, `development.md`, `public-site.md`, `student-experience.md` (with its work log), `parent-experience.md` and the README updated.

### Phase 8: Release

- [ ] SS-80 · P0 · S — **Full check**: `make test`, `make check`, both Compose stacks from a fresh clone, axe at 360 px and 1280 px on every changed page, keyboard-only run of the main flows (sign in, study, goal met, parent sees it).
- [ ] SS-81 · P0 · S — **Migration rehearsal**: apply every new migration to a copy of the latest database (or the seeded one if D1 = pre-launch), then roll back by restoring the backup; write the steps in `docs/release.md` (FE-DEP-05).
- [ ] SS-82 · P1 · S — **If D1 says there are real users**: notices to teachers and parents, an export for teachers, and a retention window before SS-55 runs.

### Rough size

Phases 0–2 and 5: about **4–5 weeks** for one developer. Phase 3: **1–1.5 weeks**. Phase 4 without practice: **1
week**; practice (SS-42..44) adds **3–4 weeks**, mostly content. Phases 6–8: **1–2 weeks** (without the admin
editor). Treat these as ranges to re-estimate after Phase 0, not commitments.

---

## 7. Risks and how each is handled

| Risk | Handling |
| --- | --- |
| Young children lose the way they sign in | SS-40 (family sign-in) ships **before** SS-54 removes classroom sign-in |
| The live stream loses its only end-to-end test when the messages tests are deleted | SS-13 ports the stream test to goals first; SS-51 can't merge until it passes |
| Parent and child see different goal numbers | One pure module (`src/features/goals/progress.ts`) used on both sides, plus an API test comparing them (the rule the parent dashboard already follows) |
| Goals met twice (retries, two tabs, offline queue) | Achievements recorded in the same locked transaction as progress, with the `(goal, period)` primary key; tests with concurrent reports |
| New data about children not covered by the privacy texts | SS-14 and SS-70; the three rules in 4.4 are part of review |
| Dropping enum values in PostgreSQL | Hand-written SQL in the SS-55 migration, rehearsed in SS-81 |
| Coverage quietly shrinks as teacher tests are deleted | The checklist in section 8; test counts recorded before and after each Phase 5 pull request |
| Scope creep into the admin content editor | SS-61 is P2 and separate; launch uses the import pipeline (SS-60) |
| The Prisma engine can't be downloaded in some environments (like the sandbox here) | Docker is the supported path; CI (BE-APP-06) caches the engine |
| The go-to-market assumed schools ("soft launch with a few schools") | D11; billing (Phase 12 of `TODO.md`) becomes more important for families and should be scheduled after Phase 8 |

---

## 8. Testing strategy

- Follow the existing split: rules in `tests/unit`, what people see in `tests/components`, the server's answers in
  `tests/api` on a real PostgreSQL.
- **Behaviour that only teacher-related test files check today, which must be moved before they are deleted:**
  - the live event stream end to end through PostgreSQL (`tests/api/messages.test.ts`, "live updates") → goals;
  - the live-updates client with a fake `EventSource` and the menu badge (`tests/components/messages.test.tsx`) → notifications;
  - picture sign-in lockout and the one-day session (auth tests that use class codes) → family sign-in;
  - due labels in the child's time zone (`tests/unit/learning-path.test.ts`, assignment cases) → goal due labels;
  - the data copy and cascade delete for every child-related table (`family`, `parent-dashboard` tests) → with goals.
- Record the test counts (unit, components, API) in every Phase 5 pull request description.
- Baseline to compare with: 321 unit and component tests, 174 API tests (section 2.1).

---

## 9. `TODO.md` tasks this plan supersedes

Mark as `[~]` "superseded by the self-study plan" in SS-04:

- **Phase 7, all of it** (FE-TCH-01..12). FE-TCH-02..05 carry on as SS-61 (admin), FE-TCH-12 as an admin AI assist if wanted.
- BE-APP-07 (classes API), FE-AUTH-06's class part (replaced by SS-40), FE-AUTH-07's school-created accounts.
- FE-PAR-04 (messages with teachers), FE-COM-03 (class discussions), FE-ADM-01 (school admin), FE-BILL-04 (school license).
- Phase 11 (live classes).
- FE-DS-15 and FE-PERF-06, where they mention the gradebook and rosters (keep what applies to other lists).
- "Suggested order for a first public launch": replaced by section 6 of this plan.

Re-scoped, not removed: FE-PAR-03 (SS-34), FE-COM-01 (SS-30), FE-ASM-04 (self-check, SS-41), FE-ASM-06 and
BE-PRA-02/03, FE-PRA-04 (SS-42..44), BE-FML-06 (formula authoring by admins).
