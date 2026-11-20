# Parent experience: developer reference

> What a parent sees about their children, the goals they set, the parental controls and the family code.
> **Plain-language guide for parents**: [`parent-guide.md`](parent-guide.md).

Parents sign in on their own page (`/sign-in/parent`, [`auth.md`](auth.md)); everything below is for parents, about
their own children only (anyone else's child is a 404, on the API and the pages). Children never see these pages.

**Try it**: sign in as `parent@lumina.test` at `/sign-in/parent` (password `lumina-demo-password`). Leo has a finished
course, a certificate, badges, a streak and three goals Pat set (an hour a week, three days a week, finish
"Fractions Made Simple"); Maya hasn't started, so her page shows every empty state. On Leo's **Goals** tab, set a
goal and watch "Leo will see: …" before saving; then sign in as `leo10` at `/sign-in/student`: his home page leads
with the goal that needs attention, with Pat's note. Finish a lesson and the "Goal met!" celebration appears when it
meets one. Set a bedtime around the current time with **Lessons and quizzes pause** and Leo's lessons show the break
screen.

## Pages

| Page | What it is |
| --- | --- |
| `/family` | **Overview**: a card per child (grade, last active, last 7 days' time in lessons, streak, lessons, courses, latest quiz, **goals: met / on track / behind / missed**, controls), each linking to the child's page. The cards stream in under the greeting |
| `/family/children/{id}` | The child's **Progress**: numbers, doing well / worth practising, courses with progress bars, quiz results (latest try of each quiz), **goals** (the same cards as the child's, with the parent's note and past weeks), learning time (14 days; the chart's numbers are also a table for screen readers), recent activity (including goals met), badges and certificates, controls in force. **Download report (PDF)** for 7, 30 or 90 days |
| `/family/children/{id}/goals` | **Goals**: the child's goals (pause, resume, remove with a confirmation) and **Set a new goal**: the kind, the target, the course or quiz, the day, a note; a sentence says what the child will see before saving |
| `/family/children/{id}/controls` | **Parental controls**: daily learning time (15 min to 2 h), bedtime (from / until, may cross midnight), and what happens then (a reminder, or lessons and quizzes pause), with a plain-words summary before saving |
| `/family/children` | My children (add, link, sign-in, data copy, delete) and the **family code** for picture sign-in |
| `/help/parents` (public) | **Help for parents** in the help centre: every topic by category, searchable; `#help-{topic}` opens one, and links go to the parent's chosen child when signed in. `/family/help` redirects here. The **?** button in the top bar opens the same help as a side panel, starting with the topics for the page |

## Goals

A parent sets up to **5 goals** per child (active and paused), one of each kind per course or quiz:

| Kind | Target | Counts |
| --- | --- | --- |
| `weekly_minutes` | 5 min to 20 h | Minutes of learning Monday–Sunday (lessons; `learning_days.seconds_spent`) |
| `weekly_active_days` | 1–7 | Days of the week with any learning: a lesson, a quiz or a review |
| `weekly_lessons` | 1–50 | Lessons finished Monday–Sunday |
| `finish_course` | the whole course, by `due_on` | The course's lessons done (finished when its certificate is issued) |
| `quiz_score` | 10–100 % (optionally by `due_on`) | The best finished try **started after the goal was set** |

- **One set of rules, both sides** (`src/features/goals/rules.ts`, pure): the title ("Learn 1 hour a week"), the
  state (**met**, **on track**, **behind** (below the even pace for the days already over; more lessons left than days;
  a quiz tried below the score), **missed** (not enough days left this week, or the day passed), **paused**), a label
  ("40 of 60 minutes this week") and a hint ("20 more minutes by Sunday"), and the past weeks (whole weeks since the
  goal was set). Weeks run Monday to Sunday in the child's time zone. An API test checks the child's
  `GET /api/learn/goals` and the parent's page return identical goals.
- **Met once** (`goal_achievements`, primary key goal + week): recorded by the lesson progress report, the quiz submit
  or the review answer that met it (in the same transaction, so retries and concurrent reports count once), or
  by the next page that shows it. The report and the quiz answer return `goals_met` for the child's "Goal met!"
  celebration; the parent's page shows "Met 3 weeks so far" and "Met the goal …" in recent activity.
- **Insights**: a goal met is "doing well"; a goal behind or missed is "worth practising", with what's left.
- **Paused** goals stay on the parent's page ("Not shown to your child until you resume it") and never count.
- **Private**: goals are about the child; any of the child's guardians can see and change them; they are in the
  parent's data copy and the privacy policy, and are deleted with the child (or when removed).

## The family code

Young children sign in at `/sign-in/pictures`: the family code, their name, then their three pictures. The parent
makes the code under My children (`FamilyCodeCard`, `GET` / `POST /api/me/family-code`): 6 characters without
look-alikes, shown in groups of three; **Make a new code** (with a confirmation) stops the old one at once. The
card lists which children sign in with it (those whose sign-in uses pictures). Details: [`auth.md`](auth.md).

## Help

The **?** button in the top bar (and the `?` key) opens help for parents: 14 topics in
`src/features/help/content/parent.ts`, never the students' topics. Links in a topic use `:child` for "the child
whose pages you are on, or the one chosen in the top bar", and go to **My children** when there is none. The same
topics are public at `/help/parents`, so families can read them before signing up (on the public pages, the **?**
button's getting-started help searches all help, parents' included). How help works and the writing rules:
[`design.md`](design.md#help).

## More

- **Accurate**: the numbers come from the functions the child's own dashboard uses (`learningStats`,
  `summarizeCourse`, `goalsOf`), in the child's own days, so parent and child never see different numbers (API
  tests compare them). The dashboard card and the child's page are built from the same data (`loadProgress` in
  `src/server/family/progress.ts`).
- **Insights are rules, not a score** (`src/features/family/insights.ts`): doing well = a finished course, a quiz at
  80% or more, a streak of 3+, a goal met; worth practising = a quiz under 60%, review questions missed twice or
  more, a goal behind or missed.
- **The report** (`src/server/family/report-pdf.ts`): A4, pdf-lib with Lexend embedded (like the certificates),
  tables that continue on the next page with their header, page numbers; a **Goals** table (goal, now, state, times
  met); learning time per day up to 14 days, per week beyond. The file name carries the date and period, never the
  child's name. A plain GET form, so it downloads without JavaScript.
- **Private**: the pages show no quiz answers, notes or sign-in details (the data copy has everything).
- **Controls on the child's side** (`src/features/learn/controls.ts`, `components/learning-controls.tsx`): the
  student layouts read them on the server; a banner on the app-shell pages, and on lessons, quizzes and review
  either a one-time reminder or the break screen ("Time for a break" / "It's bedtime"). Learning time is time in
  lessons (what the lesson player reports), refreshed every minute and after each progress report; bedtime uses the
  device clock. Progress and quiz answers are saved before the break screen appears. It is a reminder system inside
  Lumina, not a device lock.

## API

| Method and path | Body / answer |
| --- | --- |
| `GET /api/me/children/overview` | `ChildOverview[]` (`src/features/family/contract.ts`), with `goals: { active, met, on_track, behind, missed, paused }` |
| `GET /api/me/children/{id}/progress?days=14` | `ChildProgress` (`days` 1–90), with `goals: Goal[]` |
| `GET /api/me/children/{id}/report?days=30` | The PDF (`days` 7, 30 or 90; `inline=1` to open instead of download) |
| `GET` · `PUT /api/me/children/{id}/controls` | `ParentalControlsView` · `{ daily_minutes, bedtime: { start, end } \| null, when_reached: "remind" \| "pause" }` (the whole set; 422 with the field otherwise) |
| `GET` · `POST /api/me/children/{id}/goals` | `Goal[]` (active and paused, what needs attention first; `src/features/goals/contract.ts`) · `{ kind, target?, course_id?, quiz_id?, due_on?, note? }` → 201 `Goal`. 422 with `details[].field` (`body.target`, `body.course_id`, `body.quiz_id`, `body.due_on`, `body.note`); 409 `goal_exists`, `too_many_goals` |
| `PATCH` · `DELETE /api/me/children/{id}/goals/{goal_id}` | `{ target?, due_on?, note?, status?: "active" \| "paused" }` → `Goal` · 204 (the goal and when it was met) |
| `GET /api/me/children/{id}/goals/options` | `GoalOptions`: the child's started, unfinished courses; the quizzes of their courses; `count` and `limit` |
| `GET` · `POST /api/me/family-code` | `FamilyCode` (`{ code, children_with_pictures }`) · a new code (201) |
| `GET /api/learn/goals` (the student) | `Goal[]`: their active goals |
| `GET /api/learn/controls` (the student) | `StudentControls`: the settings and `minutes_today` |

Data: `parental_controls` (one row per child, any guardian edits it), `learning_goals` and `goal_achievements`
(deleted with the child), `users.family_code` (parents). All in the parent's data copy and the privacy policy.

Tests: `tests/unit/goals.test.ts` (weeks, due days, titles, every kind and state, pace, history, order),
`tests/unit/parent.test.ts` (bedtime across midnight, limits, descriptions, activity with goals met, insights with
goals, dates), `tests/components/parent.test.tsx` (cards with goal counts, the child's page with goals and its empty
states, setting a goal with its summary and field errors, a 409 from the server, pause and remove with a
confirmation, the limit, the family code card, the report form, the controls form, the break screen and reminders),
`tests/api/goals.test.ts` (every kind, validation to the field, the limit and duplicates under concurrent requests,
edit / pause / resume, options, guardians and strangers, met once with retries and concurrent reports, quiz tries
after the goal, reviews, paused goals), `tests/api/parent-dashboard.test.ts` (accuracy against the child's own numbers
and goals, every section, periods, privacy, the PDF on several pages, controls and validation, data copy and
deletion), `tests/api/family.test.ts` (the family code).
