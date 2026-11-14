# Lumina

Lumina is a learning platform for Grades 1 to 12. This repository is the whole application: pages, API and database access in **one Next.js app** on **PostgreSQL**. It has the public site (home page with the grade picker, subjects and a sample lesson; a searchable course list, a page per course, grade and subject pages, pricing; privacy, terms, cookies, children's safety and contact pages), accounts for students, parents, teachers and admins, and the student experience: a lesson player with streaming video, progress that survives bad connections, badges, levels and certificates (see [Student experience](#student-experience-phase-5)).

| | |
| --- | --- |
| Stack | Next.js 16 (App Router, Route Handlers), React 19, TypeScript (strict), Tailwind CSS 4, TanStack Query |
| Data | PostgreSQL 16, Prisma ORM 7 (schema in `prisma/schema.prisma`, SQL migrations in `prisma/migrations/`, node-postgres driver adapter) |
| Auth | Database sessions in httpOnly cookies, argon2id, TOTP two-step verification, Google / Microsoft / Apple (OpenID Connect) |
| UI | Design system on Radix primitives, react-hook-form + zod, lucide icons, Lexend |
| Tooling | Docker Compose for development (hot reload, PostgreSQL, Mailpit), ESLint, Vitest + Testing Library (unit, component and API tests), Makefile |

There is no separate backend service. The browser calls this app's own API under `/api` (Route Handlers in `src/app/api`), which uses the server code in `src/server` (services, auth, database). Server Components call the same services directly, without HTTP. How it fits together: [`docs/backend.md`](docs/backend.md). Sessions and sign-in: [`docs/auth.md`](docs/auth.md). Public pages, SEO and the legal texts: [`docs/public-site.md`](docs/public-site.md).

## Quick start

You need **Docker** (Docker Desktop on macOS and Windows, or Docker Engine with Compose v2 on Linux). Nothing else: no Node.js, no PostgreSQL, no configuration files.

```bash
git clone <this repository> lumina && cd lumina
docker compose up          # or: make up
```

The first start builds the development image and installs dependencies (a few minutes); later starts take seconds. When the log says `ready`, open:

| | |
| --- | --- |
| **http://localhost:3000** | The app, with hot reload: save a file and the page updates |
| **http://localhost:8025** | Mailpit: every email the app sends (sign-up links, password resets) |

`docker compose up` starts three containers (`compose.yaml`): **db** (PostgreSQL 16), **mail** (Mailpit) and **app** (`next dev` on your checkout, which is mounted into the container). Each time the app container starts it installs dependencies if `package-lock.json` changed, applies new migrations, and adds the sample courses and demo accounts if they are missing. All demo accounts use the password `lumina-demo-password`:

| Who | Sign in with |
| --- | --- |
| Admin | `admin@lumina.test` at `/sign-in` |
| Teacher (verified) | `teacher@lumina.test` at `/sign-in` |
| Parent (children Maya and Leo) | `parent@lumina.test` at `/sign-in` |
| Student (one course finished, with a certificate) | username `leo10` at `/sign-in/student` |
| Young student | class code `MAPLE42`, then Maya, then the pictures cat, sun, tree at `/sign-in/class` |

### Everyday commands

| make | docker compose | What it does |
| --- | --- | --- |
| `make up` | `docker compose up` | Start everything and follow the logs (Ctrl+C stops) |
| `make start` / `make logs` | `docker compose up -d` / `docker compose logs -f app` | Start in the background / follow the app's logs |
| `make down` | `docker compose down` | Stop and remove the containers; the database is kept |
| `make reset` | `docker compose down -v && docker compose up --build` | Start from scratch: empty database, fresh dependencies |
| `make test` | `docker compose exec app npm test` | Run all the tests (the API tests create their own `lumina_test` database) |
| `make test-unit` | `docker compose exec app npm run test:unit` | Only the fast unit and component tests (no database) |
| `make shell` | `docker compose exec app sh` | A shell in the app container: `npm run lint`, `npm run typecheck`, `npx prisma …` |
| `make db-generate NAME=add_x` | `docker compose exec app npm run db:generate -- --name add_x` | Write a migration after changing `prisma/schema.prisma` and regenerate the client (the migration is applied on the next start, or `make migrate`) |
| `make db-check` | `docker compose exec app npm run db:check` | Check that the database matches `prisma/schema.prisma` (nothing left to migrate) |
| `make psql` | `docker compose exec db psql -U lumina -d lumina` | SQL prompt on the development database |
| `make rebuild` | `docker compose up --build -d app` | Rebuild the app image after changing the `Dockerfile` |

Optional settings (other ports, hot-reload polling, social sign-in keys) go in a `.env` file next to `compose.yaml`; the choices are listed at the top of `.env.example`. For example, if PostgreSQL already runs on your machine: `DB_PORT=5433`.

Your editor can use the containers' setup too: the database is on `localhost:5432` (user, password and database `lumina`), so database tools connect directly. For editor type checking and linting, run `npm ci` on your machine as well; it doesn't interfere with the container, which keeps its own `node_modules`.

### Without Docker

With **Node.js 22** (20.9 or newer) and **PostgreSQL 14+** on your machine:

```bash
npm ci                       # also generates the Prisma Client (src/generated/prisma)
cp .env.example .env.local   # DATABASE_URL points at localhost:5432
make db                      # optional: PostgreSQL and Mailpit in Docker (docker compose up -d db mail)
npm run db:migrate && npm run db:seed
npm run dev
```

Without `SMTP_URL`, emails are printed in the terminal; with `SMTP_URL=smtp://localhost:1025` (and `make db`) they go to Mailpit.

## Run in production mode

`compose.prod.yaml` runs the app the way it is deployed: the built, standalone image (no hot reload), with migrations as a one-off job before the app starts. It is a separate Compose project with its own database.

```bash
echo "AUTH_SECRET=$(openssl rand -base64 48)" >> .env          # once; keep it (see Configuration)
docker compose -f compose.prod.yaml up --build                  # or: make prod-up
docker compose -f compose.prod.yaml run --rm migrate npm run db:seed   # optional: sample data
```

Port 3000 already taken? `WEB_PORT=3001 APP_URL=http://localhost:3001 docker compose -f compose.prod.yaml up --build`. Emails appear in `docker compose -f compose.prod.yaml logs web` until `SMTP_URL` is set.

The image holds almost no configuration: the database, secrets, OAuth keys and SMTP are read when the container starts. Only the public address (`SITE_URL`) is set at build time, because canonical URLs, the sitemap and share images are part of the prerendered pages; an image built without it is kept out of search engines. To deploy, run the `migrator` target once per release, then the default target:

```bash
docker build --target migrator -t lumina-migrate . && docker run --rm -e DATABASE_URL=… lumina-migrate
docker build --build-arg SITE_URL=https://lumina.example -t lumina-web .
docker run -p 3000:3000 -e DATABASE_URL=… -e AUTH_SECRET=… -e APP_URL=https://lumina.example lumina-web
```

## Configuration

Server-side and read at run time, except the two marked *build*. Validated when the server starts (`src/server/config.ts`): a missing or invalid value stops it with a clear message. Locally, put them in `.env.local` (see `.env.example`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | PostgreSQL connection string, e.g. `postgres://lumina:lumina@localhost:5432/lumina` |
| `DATABASE_POOL_MAX` | `10` | Connections per server process |
| `AUTH_SECRET` | required in production | At least 32 characters (`openssl rand -base64 48`). Encrypts two-step verification secrets: **keep it stable**, changing it turns off everyone's authenticator app. |
| `APP_URL` | from the request's Host | This site's public address, e.g. `https://lumina.example`. Used in emails, redirects and the social sign-in callback. **Set it in production.** |
| `SITE_URL` (*build*) | `APP_URL`, then `http://localhost:3000` | The public address in canonical URLs, `sitemap.xml`, `robots.txt` and share images. A build pointing at localhost is marked noindex. |
| `SITE_NOINDEX` (*build*) | `false` | `true` keeps a build with a real address out of search engines (previews, staging) |
| `COOKIE_SECURE` | by protocol | Force `Secure` cookies on (`true`) or off (`false`) |
| `SMTP_URL` | none: emails go to the log | `smtps://user:password@host:465` for any provider (SES, Postmark, Mailgun…) |
| `MAIL_FROM` | `Lumina <no-reply@lumina.local>` | Sender of every email |
| `GOOGLE_CLIENT_ID` / `_SECRET` | off | "Continue with Google" appears once both are set |
| `MICROSOFT_CLIENT_ID` / `_SECRET`, `MICROSOFT_TENANT` | off, `common` | "Continue with Microsoft" |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | off | "Continue with Apple" (the `.p8` key as PEM; `\n` sequences allowed) |

Register `<APP_URL>/auth/callback` as the redirect URI with each social sign-in provider.

## Commands

The npm scripts. Run them in the app container (`make shell`, or `docker compose exec app npm run …`) or on your machine; `make help` lists the Docker shortcuts.

| npm | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload on :3000 (what the app container runs) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no output |
| `npm test` | All tests: unit, components and API (see Tests below) |
| `npm run test:unit` | Unit and component tests only: seconds, no database needed |
| `npm run test:api` | API integration tests on a real PostgreSQL; the test database `lumina_test` is created and migrated automatically (`TEST_DATABASE_URL` to change it) |
| `npm run test:watch` | Unit and component tests, re-run on every save |
| `npm run build` | Production build (standalone output, as used by Docker). Needs no database (with `DATABASE_URL` set, the home page is built with real catalog numbers). |
| `npm run db:migrate` | Apply the migrations in `prisma/migrations/` (`prisma migrate deploy`; the app container does it on every start). Adopts a database created by the earlier Drizzle version without changing it |
| `npm run db:generate -- --name add_x` | After changing `prisma/schema.prisma`: write the next migration (`prisma migrate dev --create-only`), to review before applying |
| `npm run db:client` | Regenerate the Prisma Client after a schema change (`prisma generate`; `npm install` does it too) |
| `npm run db:check` | Compare the database with `prisma/schema.prisma`; exit code 2 when a migration is missing |
| `npm run db:seed` | Sample catalog and demo accounts (refuses in production; the app container does it on every start) |
| `npm run db:studio` | Browse and edit the data (Prisma Studio), on your machine |
| `npm run tokens:check` | Check the contrast of every colour pair in every theme (WCAG) |

Before pushing: `make test` and `make check` (lint, type-check, contrast check and build; on your machine), or the same npm scripts in `make shell`.

## Tests

Three Vitest projects (`vitest.config.mts`):

| Folder | What | Needs |
| --- | --- | --- |
| `tests/unit` | Pure logic: validation and messages, URL state, the API client, search query parsing, server configuration, request validation, the error envelope, security helpers, the legal pages, course prices, learning analytics (progress, streaks, XP) | Nothing |
| `tests/components` | React components rendered in jsdom with Testing Library and user-event: the design system (lines of `docs/component-test-plan.md`, including the **R** regressions), forms, the course browser, sign-in (email, MFA, class pictures), the sample lesson, global search, course prices (admin), the student shell, hooks and lesson scaffold | Nothing |
| `tests/api` | The Route Handlers called like a browser would (cookies, CSRF header) against a real, freshly migrated PostgreSQL database | PostgreSQL (`make test` in Docker has one) |

`npm run test:unit` runs the first two in seconds on any machine; `npm test` runs everything. Component tests use `renderWithProviders` and `mockApi` (`tests/support/render.tsx`) and a stand-in for `next/navigation` (`tests/support/next-navigation.ts`); API tests use `Browser` and the factories in `tests/support`. When you build a feature, add tests at the level that checks it best: rules in `unit`, behaviour people see in `components`, the server's answers in `api`.

## Design system

Tokens, components, layouts, themes and the age-appropriate "grade band" presentation are documented in
[`docs/design.md`](docs/design.md). While `npm run dev` is running, open **http://localhost:3000/design** to see
everything live, switch theme (light, dark, high contrast) and reading level (Grades 1–5, 6–8, 9–12), and try the
layouts and a working form. That page exists in development only. The behaviour each component must keep is listed
in [`docs/component-test-plan.md`](docs/component-test-plan.md).

## Troubleshooting

| What you see | Likely cause and fix |
| --- | --- |
| `docker compose up`: "port is already allocated" / "address already in use" | Something else uses 3000, 5432, 8025 or 1025 (often a local PostgreSQL on 5432). Pick other ports in `.env`: `APP_PORT=3001`, `DB_PORT=5433`, `MAIL_UI_PORT=8026`, `MAIL_SMTP_PORT=1026`. |
| Edits don't show up, or only after a long delay (Docker on Windows or macOS) | File-change events from your machine don't reach the container reliably. On Windows, clone the project inside WSL 2 (`\\wsl$\…`), not on `C:\`. Otherwise set `WATCH_POLL_INTERVAL_MS=1000` in `.env` and restart (polling uses more CPU). On macOS, Docker Desktop's VirtioFS file sharing (the default) works; synchronized file shares are faster. |
| The app container stops with `exec format error` or `/bin/sh^M` | The startup script got Windows line endings. `git config core.autocrlf input`, check out again, then `make rebuild`. |
| Files created by the container (migrations, `src/generated`, `next-env.d.ts`) belong to another user (Linux) | The container runs as user 1000. If your user id differs: `sudo chown -R $(id -u):$(id -g) .` after generating files, or generate them with `npm run db:generate` / `npm run db:client` on your machine. |
| `npm ci` on your machine fails with "permission denied" on `node_modules` (Linux) | Docker created empty `node_modules` and `.next` folders as mount points for its volumes. `sudo chown -R $(id -u):$(id -g) node_modules .next`, then `npm ci`; the container is not affected. |
| Strange errors after pulling big changes | `make rebuild` (new Dockerfile), or `make reset` to start from an empty database and fresh dependencies. |
| The server stops at start with "Invalid server configuration" | A variable is missing or wrong; the message names it. In production `AUTH_SECRET` is required. |
| Course list says "Courses did not load", or pages show "This page did not load" | The app can't reach PostgreSQL. Check `DATABASE_URL`, that the database runs (`docker compose ps`), and `/api/health` (503 while the database is down). Sessions survive an outage: nobody is signed out. |
| `relation "users" does not exist` in the log | Migrations haven't run: `npm run db:migrate` (`make migrate` in Docker; in `compose.prod.yaml` the `migrate` service must finish first). |
| `Cannot find module '@/generated/prisma/client'` | The Prisma Client hasn't been generated: `npm run db:client` (or `npm ci`). In Docker it is generated when the app container starts. |
| A new model or field is "undefined" / a type error after a schema change | Regenerate the client: `npm run db:client`. |
| `npm run db:migrate`: "The database schema is not empty" (P3005) | The database has tables but no migration history (not created by this app, or restored without `_prisma_migrations`). Use an empty database, or see "Databases created before Prisma" in `docs/backend.md`. |
| `npm run db:migrate`: "created by an older version of Lumina (Drizzle migrations)" | A development database from before the move to Prisma that missed some Drizzle migrations. Start from an empty one: `make reset` (Docker), or drop and recreate it. |
| `npm run db:generate`: "permission denied to create database" | Prisma's shadow database: the database user needs `CREATEDB` (`ALTER ROLE lumina CREATEDB`). The Docker database user has it. |
| No sign-up or password-reset email arrives | With `docker compose up`, look in Mailpit: http://localhost:8025. Without `SMTP_URL`, emails are only printed to the server log. |
| Sign-in "works" but the next page is signed out | `COOKIE_SECURE=true` on a site served over plain HTTP: browsers drop Secure cookies there. Serve over HTTPS, or unset it. |
| Google / Microsoft / Apple sign-in returns to the wrong address | Set `APP_URL` to the address people use, and register `<APP_URL>/auth/callback` with the provider. |
| "Continue with …" buttons don't appear | That provider's keys aren't set; buttons only show for configured providers (`/api/auth/oauth/providers`). |
| `Port 3000 is already in use` (without Docker) | Stop the other process, or run `npm run dev -- -p 3001`. |
| "Transaction not found" / "Unable to start a transaction in the given time" (P2028) in the server log | Something is closing the Prisma Client while requests use it. `getDb()` must be the only place that creates one; never call `$disconnect()` in request code. |
| `npm test` fails to connect | Run it in Docker (`make test`), or make PostgreSQL available at `TEST_DATABASE_URL` (default `postgres://lumina:lumina@localhost:5432/lumina_test`) with permission to create that database. |

## API

This app's own API, under `/api`. Request and response types are shared with the browser code in `src/features/auth/contract.ts`, `src/features/catalog/types.ts` and `src/features/learn/contract.ts`. Errors use one envelope, `{"error": {"code", "message", "details", "request_id"}}`; `details[].field` (e.g. `body.email`) puts a message next to that form field.

| Area | Endpoints |
| --- | --- |
| Catalog (public) | `GET /api/courses` (`grade_level`, `subject`, `q`, `limit`, `offset`), `GET /api/courses/slug/{slug}`, `GET /api/subjects` |
| Search (public) | `GET /api/search?q=…&limit=5&grade=&subject=`: courses and lessons, instant (prefix) matching, synonyms (maths/math), typo tolerance with "did you mean", grades ("grade 4") |
| Sign-in and sign-up | `/api/auth/*`: register, verify email, login (email, username, MFA step, class pictures), class roster, OAuth, logout, password reset, email change confirmation |
| Own account | `/api/session`, `/api/me/*`: profile, password, email, sessions, two-step verification, linked accounts, teacher profile, children (add, link, sign-in, delete, data copy), link codes |
| Learning (students) | `/api/learn/*`: enrolments, course progress, lessons, progress reports, summary, assignments, recommendations, learning paths, review and practice, badges, certificates (PDF) — see [Student experience](#student-experience-phase-5) |
| Teaching | `/api/teach/*`: a verified teacher's classes and the work they set, with each student's progress |
| Administration | `/api/admin/users/*`, `/api/admin/courses/*` (course prices), `/api/impersonation` |
| Operations | `GET /api/health` (200 when the database answers) |

The full list with rules for each endpoint is in [`docs/auth.md`](docs/auth.md) and [`docs/backend.md`](docs/backend.md).

## Student experience (Phase 5)

Everything a student does in Lumina: the student area and its home screen, the lesson player (with video), notes and bookmarks, progress that survives bad connections, assigned work, recommendations, learning paths, review and practice, gamification and certificates. Build new student screens **on these pieces** rather than beside them, and add a line to the [work log](#student-experience-work-log) when you do.

**Plain-language guide for students, parents and teachers**: [`docs/student-guide.md`](docs/student-guide.md).

**Try it**: sign in as `leo10` (`/sign-in/student`, password `lumina-demo-password`). Leo has one finished course with its certificate and a streak. Open `/courses/fractions-made-simple`, press **Start learning**, and work through the four lessons: the first has a real streaming video with captions, a quick check and a worksheet, the second an illustration. Finishing the fourth issues a certificate (dialog, then `/learn/certificates`, preview and PDF). Turn the network off in the browser's dev tools and press **Done**: the header says "Offline: saved on this device", and it is sent when you are back. Leo's home also shows work his teacher set (due tomorrow, in 5 days, in 12 days), questions to review from the course he finished, recommendations and his learning path (Pre-Algebra locked until Ratios and Rates is done). The teacher side of assignments is an API for now: sign in as `teacher@lumina.test` and call `GET /api/teach/classes`.

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
| `src/features/learn/hooks.ts` | `useLessonView`, `useCourseProgress`, `useEnrollments`, `useLearningSummary`, `useAssignments`, `useRecommendations`, `useLearningPath`, `useReviewOverview`, `useReviewSession`, `useAnswerReview`, `useBadges`, `useCertificates`, `useEnroll`, `useUnenroll` (optimistic), and the `learnKeys` query-key factory. |
| `src/features/learn/sync/` | `progress-queue.ts`: the offline queue (pure, unit-tested). `progress-sync.tsx`: `ProgressSyncProvider`, `useProgressSync()`, `useProgressResults()`, `<SaveStatus />`. |
| `src/features/learn/blocks.ts` | Lesson content: the block types and their validation (`parseBlocks`), the embed allow-list. |
| `src/features/learn/analytics.ts` · `badges.ts` | Pure learning maths: progress, "continue", streaks, minutes, XP, levels; badge definitions and who earns what. |
| `src/features/learn/path.ts` · `recommend.ts` · `spaced.ts` · `assignments.ts` | Pure rules: the learning path and its lock rule, recommended courses, spaced review, assignment status and due dates. |
| `src/features/learn/student-area.tsx` | What wraps every student page: `StudentProvider` (`useStudent()`), the progress queue, the celebrations. Used by both layouts. |
| `src/features/learn/components/` | `student-dashboard`, `lesson-player`, `notes-panel`, `notebook`, `lesson-outline`, `lesson-blocks`, `video-player`, `learning-path`, `assignments-list`, `recommendations`, `review-overview`, `practice-session`, `celebration`, `gamification`, `achievements-nav`, `my-courses`, `course-home`, `certificates-list`, `certificate-view`, `start-learning`. |
| `src/server/learning/paths.ts` · `review.ts` · `assignments.ts` · `notes.ts` · `src/server/teaching/service.ts` | Learning paths and recommendations, the review queue, the student's assignments; the teacher API for setting work. |
| `src/server/learning/service.ts` · `certificate-pdf.ts` | Server rules (students only, own data only, idempotent and serialized progress, badges, certificates, billing hook `assertCanEnroll`) and the certificate PDF. |
| `src/hooks/use-visible-seconds.ts` | `useVisibleSeconds()`: time on task, counted only while the page is visible. |

### 1. Pages and the two student shells

| Page | Shell | What it is |
| --- | --- | --- |
| `/learn` | app (`(app)/learn`) | The home screen students land on: continue learning (or the soonest assignment), questions to review, work due soon, streak, level and XP, numbers, recommended courses, the learning path, badges, recent courses, certificates, the celebrations switch |
| `/learn/courses` | app | My courses: progress bars, Start / Continue, certificate link (tab: Notes and bookmarks) |
| `/learn/notes` | app | Notes and bookmarks: every note and bookmark, searchable (`?q=`), each opening its spot in the lesson |
| `/learn/courses/{course}` | app | The course from the student's side: progress, Start / Continue, outline with statuses, leave the course |
| `/learn/courses/{course}/lessons/{lesson}` | focus (`(focus)/learn`) | The lesson player |
| `/learn/path` | app | Learning path per subject (`?subject=`): done, in progress, next, open, locked with the reason |
| `/learn/assignments` | app | Work set by the student's teachers: overdue, due this week, later, done |
| `/learn/review` | app | Review queue and practice, per course, with how the spacing works |
| `/learn/review/session?mode=review\|practice&course=…` | focus | One question at a time, instant feedback, the next review date in words |
| `/learn/badges` | app | The whole badge shelf, earned and still to earn (Achievements) |
| `/learn/certificates` | app | Certificates: preview, download PDF, open PDF (Achievements) |
| `/courses/{course}` (public) | site | **Start learning** for students, "Students: sign in to start" for visitors (`StartLearning`) |

Both student layouts check the session on the server (other roles go to their own home; signed-out visitors to sign-in and back) and wrap the page in `StudentArea`, so everything below can use `useStudent()`, `useProgressSync()` and gets the celebrations. Put a page in `(app)/learn` when it needs navigation, in `(focus)/learn` when the student should see nothing but the task. Sidebar items live in `src/config/navigation.ts`: **Home, My courses, Learning path, Assignments, Review, Achievements** (six, so a child never hunts; My courses also covers `/learn/notes`, Achievements covers badges and certificates). `ready: false` hides an item until its page exists; `match: [...]` highlights an item on extra paths (Achievements covers `/learn/badges` and `/learn/certificates`, switched by `AchievementsNav`). Server Components read data with the services directly: `requirePageAuth(["student"])` gives them the same `Auth` the API routes use.

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
- **Media files** live in `public/media/lessons/{lesson}/` (served as static files; the production image copies `public/`). Moving them to a CDN or object storage (BE-MEDIA) only changes the URLs in the content. How the sample was made (ffmpeg, fMP4 segments so no `.ts` files confuse TypeScript): [`docs/lesson-media.md`](docs/lesson-media.md).

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
- **Durable and per student**: kept in `localStorage` (`lumina:progress-queue`, listed in the cookie policy) under the student's id, so closing the tab loses nothing and, on a shared classroom device, one child's progress is never sent under another child's session.
- **Patient**: retries back off 1 s → 30 s, pause while offline and resume on `online`; a refusal that can't get better (not enrolled any more) is dropped and shown; when the page is hidden or closed, what's left is sent with `keepalive`.
- **Server side**: `PUT /api/learn/lessons/{id}/progress` locks the enrolment row, so simultaneous reports (two tabs, a retry) apply one after another; completing a lesson counts once; finishing the last lesson completes the course and issues its certificate in the same transaction.
- **After a confirmed report**, cached learning data is refreshed (`learnKeys.all`), and `useProgressResults(listener)` lets components react (the celebrations do).

### 6. The home screen, assignments and recommendations (FE-STU-01)

The dashboard (`components/student-dashboard.tsx`) puts the most useful next step first: the course in progress ("Continue learning"), or, when nothing is in progress, the **soonest assignment** ("Next up: assigned by …"), then questions to review. Each part loads on its own, so one slow request never blanks the page.

- **Assigned work** (`components/assignments-list.tsx`, `assignments.ts`): status from the student's own lesson progress (not started / in progress / done, with "2 of 4 lessons" for whole-course work); due dates in the student's calendar days ("Due tomorrow", "Overdue by 2 days"); grouped on `/learn/assignments`, the next 7 days on the dashboard.
- **Recommended next courses** (`components/recommendations.tsx`, rules in `recommend.ts`): three courses, each with its reason, from simple rules in order of strength: the next course of a path the student finished ("Next after Decimals and Percentages"), more of a subject they take ("More Mathematics"), their grade or one step ahead ("For Grade 5"). Never a course taken, locked, or far from their grade.
- **Teachers set the work** through `/api/teach` (BE-SCH-03): verified teachers only, their own classes only; a whole course or one lesson, with a due date and instructions; each student's progress on it comes back per assignment (FE-TCH-07's "track completion per student"). The teacher screens are FE-TCH-06/07.

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
- **Private**: teachers and other students never see notes or bookmarks (another student's note answers 404). A parent's copy of their child's data includes them, like everything stored about the child; the privacy policy says so. Note text is plain text, never HTML, and never logged.
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

### 12. The API

All under `/api/learn`, **students only** (others get 403), always about the signed-in student (the id comes from the session, never from the request):

| Method and path | Body / answer |
| --- | --- |
| `GET /api/learn/enrollments` | `Enrollment[]`: "My courses" with `progress` (`percent`, `lessons_completed`, `next_lesson`), most recently active first |
| `POST /api/learn/enrollments` | `{ course_id }` → `Enrollment`, 201 (200 if already enrolled). Published courses only |
| `DELETE /api/learn/enrollments/{course_id}` | 204; progress and certificates are kept |
| `GET /api/learn/courses/{course_id}/progress` | `CourseProgress`: each lesson's `status`, `enrolled`, the summary |
| `GET /api/learn/lessons/{lesson_id}` | `LessonView`: lesson, `blocks` (empty before enrolment), outline with statuses, previous / next, video positions |
| `PUT /api/learn/lessons/{lesson_id}/progress` | `{ status, seconds?, media?, report_id? }` → `LessonProgressResult` (`duplicate`, `course_completed`, `new_badges`, `level`, `certificate`). 409 `not_enrolled` before enrolling |
| `GET /api/learn/summary` | `LearningSummary`: streak, XP, level, lessons, courses, minutes, continue learning, badges and certificates counts |
| `GET /api/learn/badges` | `Badge[]`: the whole shelf, `earned_at` or null |
| `GET /api/learn/certificates` · `/{id}` · `/{id}/pdf` | `Certificate[]`, one `Certificate`, the PDF (`?inline=1` to view in the browser) |
| `GET /api/learn/assignments` | `StudentAssignment[]`: work set for the student's classes, with status and progress, not done first |
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

Teachers (verified, own classes only; `src/features/teach/contract.ts`, `src/server/teaching/service.ts`):

| Method and path | Body / answer |
| --- | --- |
| `GET /api/teach/classes` | `TeacherClass[]` |
| `GET /api/teach/classes/{class_id}/assignments` | `TeacherAssignment[]`: each with every student's status and lessons done |
| `POST /api/teach/classes/{class_id}/assignments` | `{ course_id, lesson_id?, title?, instructions?, due_at }` → 201 `TeacherAssignment` (published course, lesson of that course, date not passed) |
| `DELETE /api/teach/assignments/{id}` | 204 |

**New endpoint checklist**: type + path in `contract.ts` → service function with a zod input in `src/server/learning/service.ts` → thin route in `src/app/api/learn/` → function in `api.ts` → hook in `hooks.ts` (key in `learnKeys`) → API test in `tests/api/` (see "Adding an endpoint" in [`docs/backend.md`](docs/backend.md)).

### 13. Data about students

| Table | One row per | Holds |
| --- | --- | --- |
| `enrollments` | student and course | enrolled, completed, last lesson opened ("Continue"), last activity |
| `lesson_progress` | student and lesson | `started` or `completed` (never goes back), seconds spent, video positions |
| `learning_days` | student and day (their time zone) | seconds spent, lessons completed: streaks and minutes |
| `progress_receipts` | applied progress report | the report id, 7 days: retries count once |
| `student_badges` | student and badge | when it was earned |
| `certificates` | student and course | the certificate, with names as they were |
| `review_items` | student and quick-check question | Leitner box, reviews, misses, when it is due |
| `assignments` | piece of work set for a class | course or lesson, title, instructions, due date (progress comes from `lesson_progress`) |
| `course_prerequisites` | course and a course it builds on | the learning paths |
| `lesson_notes` | note | the student's text, the lesson and part it is about |
| `lesson_bookmarks` | bookmark | the lesson, a part, or a video moment (`anchor` keeps each one unique) |

Days are aggregated on purpose: no event stream about children is stored. Deleting a child's account deletes all of it (cascade).

**Storing something new about students?** Three things in the same pull request, because the legal pages are written from the code: describe it in the privacy policy (`src/features/legal/content/privacy.tsx`, "What we collect" and "How long we keep it"), add it to the parent's data copy (`childDataCopy` in `src/server/family/service.ts`, type `ChildDataExport`), and make sure deleting the account deletes it (`onDelete: Cascade` on the student relation). New browser storage also needs a `STORAGE_KEYS` entry and a line in `src/features/legal/device-storage.ts` (a test enforces it).

### 14. Tests

| File | Covers |
| --- | --- |
| `tests/unit/learn-analytics.test.ts` | progress, "continue", days and streaks (time zones), minutes, XP and levels |
| `tests/unit/progress-queue.test.ts` | merging, report ids reused on retry, backoff, permanent failures, offline, per-student storage, keepalive, UI notifications |
| `tests/unit/lesson-content.test.ts` | block validation incl. unsafe URLs and embeds, badges, player helpers |
| `tests/components/learn.test.tsx` | student context, time on task, the lesson player (outline, content, Done, offline, start prompt, course finished), quick check, video player (controls, keyboard, resume, error), certificates, badge shelf |
| `tests/api/notes.test.ts` · `tests/components/learn-notes.test.tsx` | notes and bookmarks: writing, editing, deleting, privacy between students, validation, the Note taker badge, the notebook and its links; the panel, the header toggle, video moments, jumping, failed saves keeping the text |
| `tests/unit/learning-path.test.ts` | the lock rule and its sentence, path steps, recommendations, spaced review, assignment status and due dates (time zones) |
| `tests/components/learn-home.test.tsx` | navigation, the home screen, assignments, learning path, review overview, a full review session with a retry, a locked course |
| `tests/api/learning-path.test.ts` | paths and locks (incl. 409 on a locked course), recommendations, teacher assignments and the student view, review and practice (answers hidden, scheduling, practice leaves the schedule alone, other students' questions) |
| `tests/api/learning.test.ts` · `lesson-player.test.ts` | every `/api/learn` endpoint: access, enrolment, idempotent and concurrent progress, report receipts, video positions, badges, level-ups, certificates, the PDF |

### Student experience work log

Add a line for every change to the student experience (newest first), with the task id, so this section stays the place to start.

| Date | Task | What changed | Where |
| --- | --- | --- | --- |
| 2026-11-13 | FE-STU-06 (+ BE-LRN-04), FE-STU-07/08 re-checked | Notes and bookmarks inside lessons: header bookmark toggle, notes side panel (write, about a part, edit, delete), video moments with jump buttons, `/learn/notes` (search, links back to the exact spot and moment), home-screen card, "Note taker" badge. Certificates: preview readable on phones (sideways scroll) and Open PDF in the preview. Accessibility: names built from visible content (WCAG 2.5.3), label wiring fixed. Privacy policy and the parent's data copy include notes and bookmarks. | `src/features/learn/components/notes-panel.tsx`, `notebook.tsx`, `src/server/learning/notes.ts`, `src/app/api/learn/{notes,bookmarks,notebook,lessons/[id]/…}`, migration `…_notes_bookmarks`, [`docs/student-guide.md`](docs/student-guide.md) |
| 2026-11-13 | FE-STU-01, FE-STU-09, FE-STU-10 (+ BE-SCH-03, BE-CAT-08, BE-LRN-08 backends) | Student navigation (six items, Achievements tabs) and the home screen: continue learning or the soonest assignment, review due, work due soon, recommended courses, learning path link. Learning paths with prerequisites and an explainable lock rule (enforced on enrol). Assignments: teacher API (verified teachers, per-student completion) and student views. Review queue (Leitner spacing) and practice sessions, answers checked on the server. Privacy policy and the parent's data copy include the review schedule; teachers' view of assigned work is stated. | `src/features/learn/` (`path.ts`, `recommend.ts`, `spaced.ts`, `assignments.ts`, new components), `src/server/learning/` (`paths.ts`, `review.ts`, `assignments.ts`), `src/server/teaching/`, `src/app/api/learn/`, `src/app/api/teach/`, migration `…_learning_path_review` |
| 2026-11-13 | FE-STU-02, 03, 04, 05, 07, 08 (+ FE-STU-01 partly, FE-PUB-05 enrol) | The student lesson experience: lesson player (outline sidebar and drawer, previous / next, Done, start prompt), content blocks (text, callout, image, video, file, embed, quick check) validated server-side, HLS video player (hls.js lazy, MP4 fallback, captions, speed, keyboard, resume), offline-safe progress sync with report ids, badges, XP levels and celebrations, certificates with PDF, dashboard, My courses, course home, badges and certificates pages, Start learning on course pages. Backend: lesson content, video positions, progress receipts, badges and certificates tables; 4 new endpoints. Sample video (HLS H.264 + VP9, captions), illustration and worksheet. Privacy policy, cookie policy and the parent's data copy updated. | `src/features/learn/`, `src/server/learning/`, `src/app/api/learn/`, `src/app/(app)/learn/`, `src/app/(focus)/learn/`, `public/media/`, migration `…_lesson_player` |
| 2026-11-13 | FE-STU-00 | Foundations: student shell (`(app)/learn`, `(focus)/learn`, `useStudent`), data model (enrolments, lesson progress, learning days), `/api/learn` (5 endpoints), contract + `learnApi` + hooks with optimistic updates, learning analytics, `useVisibleSeconds`, lesson scaffold. Privacy policy and the parent's data copy now include learning progress. Fixed a production bug in `getDb()` that made concurrent page renders and API requests close each other's database client (transactions failed with P2028). | `src/features/learn/`, `src/server/learning/`, `src/app/api/learn/`, `src/app/(focus)/`, `src/server/db/index.ts` |

## Project structure

Feature-based: routes stay thin, each business area owns its code, and everything server-side lives in `src/server`.

```
compose.yaml                 development stack: db, mail (Mailpit), app (next dev, hot reload)
compose.prod.yaml            production-like stack: built image, migrations as a one-off job
Dockerfile                   targets: dev, runner (production, default), migrator
prisma/                      schema.prisma (tables, relations, indexes) and migrations/ (SQL, commit them)
public/media/                lesson media served as static files (sample video as HLS + MP4, captions, images, worksheets)
prisma.config.ts             Prisma CLI configuration (schema and migrations paths, DATABASE_URL)
scripts/                     db-migrate (+ lib/migrations.ts), db-seed (+ seed-lessons, seed-content), contrast check; docker/dev-entrypoint.sh (app container start-up)
tests/                       Vitest: unit/ (pure logic), components/ (React, jsdom), api/ (Route Handlers on a real database), support/
src/
├── app/
│   ├── (marketing)/         public pages: home, courses, grades, subjects, pricing, search, privacy, terms, cookies, safety, contact
│   ├── sitemap.ts · robots.ts · opengraph-image.tsx   SEO files (course pages have their own share image)
│   ├── (auth)/              sign-in (email, student, class code + pictures), sign-up, password and email links
│   ├── (app)/               signed-in areas in the app shell: learn, teach, family, admin, account
│   ├── (focus)/             signed-in pages without the app shell: the lesson player (later quizzes)
│   ├── api/                 the API: one Route Handler per endpoint (thin: parse, call a service, answer)
│   ├── auth/                OAuth callback, session recovery
│   ├── (dev)/design/        design system reference, development only
│   └── layout.tsx …         root layout, providers, fonts, global styles, not-found and error
├── server/                  server-only code (never in the browser bundle)
│   ├── db/                  the Prisma Client (getDb), row types, database error helpers
│   ├── http/                route wrapper, error envelope, validation, CSRF, rate limits
│   ├── auth/                sessions, cookies, passwords, TOTP, one-time tokens, sign-in services
│   ├── accounts/ · family/ · admin/ · catalog/ · oauth/ · search/   domain services
│   ├── learning/            students' enrolments, progress, lessons, paths, review, assignments, badges, certificates (+ PDF)
│   ├── teaching/            teachers' classes and the work they set
│   ├── mail/                email transport and templates
│   └── config.ts            validated server configuration
├── proxy.ts                 runs before pages: guards signed-in areas, keeps the session cookie alive
├── instrumentation.ts       checks the configuration when the server starts
├── features/
│   ├── marketing/           home page sections: subjects, how it works, sample lesson, audiences, safety, FAQ
│   ├── search/              global search: query parsing, the search dialog (Ctrl+K), results, shared types
│   ├── legal/               policy layout, kids' summaries, the texts of the legal and trust pages
│   ├── catalog/             browser api, hooks, shared types, URL state, components
│   ├── auth/                the accounts contract (shared types), sign-in flows, session hooks
│   ├── learn/               student experience: contract, api, hooks, sync (offline queue), blocks, analytics, badges, components
│   ├── account/ · family/ · admin/   account settings, children, user and course-price administration
│   └── design-system/       the /design reference page
├── components/              ui/, forms/, layout/, theme/, illustrations/, feedback/
├── generated/prisma/        the generated Prisma Client (not committed; `npm install` creates it)
├── styles/tokens.css        design tokens: colours per theme, grade bands, z-index, motion
├── lib/                     API client, preferences, forms, cn, formatting, safe redirects
└── hooks/ · config/         shared hooks (preferences, debounce, visible time); site, legal and navigation config
```

## Decisions worth knowing

- **One app, one deployable**: pages, API and database access ship together. The browser only ever talks to this site, so there is no CORS and no second service to run. Server Components read the database through the services directly; the browser goes through `/api`. See [`docs/backend.md`](docs/backend.md).
- **ORM**: Prisma 7. The schema is `prisma/schema.prisma`, the generated client is fully typed, and migrations are plain SQL files generated from the schema and reviewed in pull requests (a few things Prisma can't express, like CHECK constraints and the generated search columns, are written by hand in the SQL). Queries run through the node-postgres driver adapter, with no query-engine binary, so the standalone Docker image stays small; full-text search uses typed raw SQL. See "Database" in [`docs/backend.md`](docs/backend.md) and the migration notes in [`docs/prisma-migration.md`](docs/prisma-migration.md).
- **Shared contract**: the JSON types in `src/features/auth/contract.ts` and `src/features/catalog/types.ts` are imported by both the browser code and the server that produces them, so the compiler catches a mismatch on either side.
- **Sessions**: random tokens in httpOnly, SameSite=Lax cookies; the database stores only their SHA-256. Signing out elsewhere, password changes and turning an account off take effect on the next request ([`docs/auth.md`](docs/auth.md)).
- **Rendering**: the home page is static and refreshed from the database every 5 minutes; the course list shell and the legal pages are static. Course pages are rendered from the database on first visit and cached (incremental static regeneration, refreshed at most once a minute), and show a skeleton (`loading.tsx`) while they load. Unknown courses answer with HTTP 404. `sitemap.xml` is rendered on request so it always lists every published course. Builds need no database.
- **SEO**: every public page has a canonical URL, Open Graph and Twitter cards (share images drawn by `next/og`, one per course), and structured data (schema.org `Course`, `EducationalOrganization`, `WebSite`). Signed-in areas, sign-in pages and one-time links are noindex.
- **Legal texts are code**: the policies describe what the code really does, and the cookie table is generated from the cookie and storage constants (a test fails if one is added without a description). Company details live in `src/config/legal.ts`; until a lawyer has reviewed them, the pages say they are a draft.
- **URL state**: course search filters live in the URL, so filtered views are shareable and the back button works.
- **One database client per process**: `getDb()` keeps the Prisma Client on `globalThis` and every server bundle of a production build shares it; only `next dev` swaps it for a regenerated client. (Swapping it in production made concurrent requests close each other's client.)
- **Student data**: learning progress is stored per lesson and per day, never as a stream of events, and only the student (and later their parents and teachers) can see it. Learning numbers are computed by shared pure functions, so the server and the browser always agree.
- **Errors**: the API answers every error in one envelope with a request id; the browser's API client turns it into a typed `ApiError`. An unreachable database is a 503 ("try again"), never a sign-out. The error page logs the error and shows its reference (`digest`) to quote to support.
- **Design tokens only**: components use semantic colours (`bg-surface`, `text-fg-muted`); Tailwind's default palette is switched off so a theme can change everything in one place. Contrast is checked by `npm run tokens:check`.
- **Themes and reading level**: light, dark and high contrast, plus a grade band (Grades 1–5, 6–8, 9–12) that changes text size, target size and density. Both are remembered on the device and applied by a small inline script before the page paints, so there is no flash.
- **Font**: Lexend, chosen for legibility for young readers, is self-hosted from `src/app/fonts/` through `next/font/local` (SIL OFL 1.1). Builds do not need internet access to Google Fonts.
- **Class names**: `cn()` combines `clsx` and `tailwind-merge`, so a class passed in by the caller overrides a conflicting default (for example `shadow-none` over `shadow-sticker`).
- **Footer year**: fixed at build time, so static and server-rendered pages always agree.

## Roadmap

The task-by-task plan, with priorities, sizes and acceptance criteria, is in [`TODO.md`](TODO.md).
