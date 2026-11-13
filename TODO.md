# Lumina — TODO

Task list for the Lumina app (pages, API and database in one Next.js project). Written so a human or an AI agent can pick up one task at a time and finish it without extra context.

- **Stack:** Next.js 16 (App Router, Route Handlers), React 19, TypeScript (strict), Tailwind CSS 4, TanStack Query, PostgreSQL + Prisma ORM 7
- **Architecture:** feature-based. Routes in `src/app/` stay thin; UI logic lives in `src/features/<name>/` (`api`, `hooks`, `types`, `components`); server logic in `src/server/<area>/` (services, schema), exposed under `src/app/api/`. See `docs/backend.md`.
- **Backend:** part of this app, no separate project. Task IDs like `BE-AUTH-06` come from the former backend plan and name the server-side work a task needs (see the tag table below).
- **Mobile app:** out of scope for now; Phase 16 prepares for it.

---

## How to use this file

**Task format**

```
- [ ] FE-EXAMPLE-00 · P0 · M — Title. Detail. (needs BE-AUTH-06)
      Done when: observable acceptance criteria.
```

| Tag | Meaning |
| --- | --- |
| `P0` | Required for launch. Do first. |
| `P1` | Important, can follow launch. |
| `P2` | Nice to have / later. |
| `S` / `M` / `L` / `XL` | About half a day / 1–2 days / 3–5 days / more. Split any `L` or `XL` into smaller tasks before starting. |
| `needs BE-…` | Needs server-side work: tables (`prisma/schema.prisma` + a migration), a service and API routes. Build it in this app, in the same pull request or a preceding one (follow "Adding an endpoint" in `docs/backend.md`). |

**Rules for whoever picks up a task** (human or AI)

1. Take the first unchecked task in the lowest-numbered phase whose dependencies are done. One task per pull request.
2. Keep `src/app/` thin. Put feature code in `src/features/<name>/`; put cross-feature UI in `src/components/`.
3. Server Components by default. Add `"use client"` only where state, effects, or browser APIs are needed, and keep those components small.
4. Never call `fetch` directly in components. Use the API client in `src/lib/api-client.ts` through a feature `api.ts`, and TanStack Query hooks for client-side data. Server Components call services in `src/server` directly. Schema changes always come with a generated migration (`npm run db:generate`).
5. Every screen needs four states designed and built: loading, empty, error, and success. Errors say what happened and what to do; they do not apologize.
6. Tick the checkbox in the same pull request that completes the task.

**Definition of done (applies to every task)**

- [ ] `npm run lint`, `npm run typecheck`, and `npm run build` pass
- [ ] Tests added for logic and for the main user flow (unit/component; end-to-end for critical flows)
- [ ] Keyboard-only use works, focus is visible, and there are no automated accessibility violations (axe)
- [ ] Works at 360 px wide up to desktop; no horizontal scrolling
- [ ] No hard-coded user-facing strings once i18n exists (FE-I18N-01)
- [ ] Reduced-motion preference respected for any animation

---

## Current state (already built)

- [x] Next.js app with TypeScript strict mode, Tailwind 4, ESLint, standalone Docker build
- [x] Design tokens (graph-paper background, ink and cobalt palette, sticker-style shadows, grade-band colours)
- [x] Layout: header, footer, providers (TanStack Query), not-found and error pages
- [x] API client with typed `ApiError` (maps the API's error envelope)
- [x] Backend in the app: PostgreSQL + Prisma (schema, migrations, seed), API Route Handlers, database sessions (see Phase 0b)
- [x] Landing page with the 12-tile grade picker
- [x] Courses page: filter by grade, subject, title; pagination; state kept in the URL; loading, empty, and error states
- [x] Course detail page (server-rendered, revalidated every 60 seconds, per-course metadata)
- [x] UI primitives: `Button`, `ButtonLink`, `Skeleton`

---

## Phase 0 — Gaps in the initial scaffold

- [x] FE-FIX-01 · P0 · S — Look at every page in a real browser at 360, 768, and 1280 px and fix what is off. The scaffold was verified by build and HTTP checks only, not visually.
      Done when: screenshots of home, courses, and course detail at three widths are reviewed and any layout issues are fixed.
- [ ] FE-FIX-02 · P0 · S — Verify both Compose stacks on a machine with Docker: `docker compose up` on a fresh clone (development: db, Mailpit, app with hot reload; demo accounts work; an edit reloads; `make test` passes), and `docker compose -f compose.prod.yaml up --build` (PostgreSQL, the `migrate` job, then `web`; `AUTH_SECRET` from `.env`). Try macOS and Windows (WSL 2) for hot reload.
      Status: written and checked without Docker: both Compose files validated against the Compose specification (the development one with no settings at all); the development start-up script run for real (dependency check and reinstall after a lockfile change, migrations, idempotent seed, `next dev`, hot reload with events and with polling, emails over SMTP, the test suite); the production Dockerfile stages replayed (clean context, `npm ci`, build without a database, migrations and seed, standalone server). Tick after the first successful run of each stack with Docker.
- [x] FE-OPS-09 · P0 · M — One-command development environment: `docker compose up` on a fresh clone runs PostgreSQL, Mailpit and the app with hot reload, migrates and seeds on start, and needs no configuration. Production-like run in `compose.prod.yaml`; Docker shortcuts in the Makefile.

---

## Phase 0b — Backend in the app

The app no longer depends on a separate backend project: the catalog and accounts API, sessions and data live here (`docs/backend.md`, `docs/auth.md`).

- [x] BE-APP-01 · P0 · L — PostgreSQL schema for accounts, sessions, one-time tokens, MFA, OAuth links, families, classes, catalog, audit log and rate limits; SQL migrations; `db:migrate` and an idempotent `db:seed` (sample catalog, one demo account per role). Built with Drizzle ORM first, now on Prisma (BE-APP-13).
- [x] BE-APP-02 · P0 · L — API Route Handlers for every endpoint the UI uses (catalog, `/auth/*`, `/me/*`, `/admin/*`, session, impersonation, health), sharing the contract types with the browser; one error envelope with request ids.
- [x] BE-APP-03 · P0 · L — Security: database sessions (hashed tokens, sliding expiry, revocation), argon2id, TOTP with replay protection and recovery codes, encrypted secrets, enumeration-safe sign-up and reset, lockouts and rate limits, CSRF checks, OAuth (PKCE, state, nonce), audit of admin actions.
- [x] BE-APP-04 · P0 · M — API integration tests on a real database (Vitest) and unit tests for the security primitives.
- [ ] BE-APP-05 · P0 · S — Try Google, Microsoft and Apple sign-in, sign-up and linking with real app registrations (the flow is implemented and tested end to end with a stubbed token endpoint, but has not met the real providers). Check Apple's first sign-in name and Microsoft's `xms_edov` claim.
- [ ] BE-APP-06 · P0 · S — CI: PostgreSQL service container for `npm test`; apply migrations to a copy of production data before each release.
- [ ] BE-APP-07 · P0 · M — Classes API for teachers (create a class, its code, add and remove students), with FE-TCH-06. Until then classes exist only through the seed or SQL. Only verified teachers may create classes or add pupils (the safety page promises that admins check teachers).
- [ ] BE-APP-08 · P1 · S — Only trust `X-Forwarded-For` from known proxies (setting with the proxy count or addresses), so per-IP rate limits can't be sidestepped.
- [ ] BE-APP-09 · P1 · S — Structured JSON logs with the request id, and error tracking (with FE-PERF-05); never log personal data of children.
- [ ] BE-APP-10 · P1 · M — Data retention and export: purge audit events after the period in `src/config/legal.ts` (`securityLogRetention`, stated in the privacy policy), "export my data" (FE-AUTH-09).
- [ ] BE-APP-11 · P1 · S — Emails: translated templates (with FE-I18N-01) and branded HTML; bounce handling from the SMTP provider.
- [ ] BE-APP-12 · P2 · M — Avatar uploads (object storage); `users.avatar_url` is ready.
- [x] BE-APP-13 · P0 · L — Replace Drizzle ORM with Prisma ORM 7: `prisma/schema.prisma` (same tables and names), baseline migration `prisma/migrations/20261112000000_init`, every query rewritten with Prisma Client (raw SQL only for search, lockout counters and rate limits), Prisma-aware error handling, seed, test setup, Docker and docs. Existing databases are adopted by `npm run db:migrate` without changes. Details and what was verified: `docs/prisma-migration.md`.
- [ ] BE-APP-14 · P0 · S — Check the Prisma tooling where the native schema engine can be downloaded (the environment the move was made in couldn't reach binaries.prisma.sh, so the CLI ran on a WebAssembly stand-in, see `docs/prisma-migration.md`): on a normal machine, `npm ci`, `npm run db:migrate` on an empty database and on a copy of a Drizzle-era database, `npm run db:generate -- --name x` (then delete it), `npm run db:check`, `npm run db:studio`; in Docker (Alpine + OpenSSL) the `app` start-up and the `migrate` job of `compose.prod.yaml`. Part of FE-FIX-02.
- [ ] BE-APP-15 · P1 · S — CI checks for the schema (with BE-APP-06): `npx prisma validate`, `npx prisma format --check`, and after `npm run db:migrate` on an empty database, `npm run db:check` (fails when `schema.prisma` changed without a migration).
- [ ] BE-APP-16 · P2 · S — Once every database has been adopted (no `drizzle` schema left in any environment), delete the Drizzle adoption code: `adoptDrizzleDatabase` in `scripts/lib/migrations.ts`, its call in `scripts/db-migrate.ts`, the test-database recreation in `tests/support/global-setup.ts`, and the "Databases created before Prisma" notes.
- [ ] BE-APP-17 · P2 · S — Consider Prisma TypedSQL (`prisma/sql/*.sql`) for the search queries, for generated result types instead of hand-written row interfaces. It needs a database when generating the client, which the Docker build doesn't have: decide how (generate in CI with a database, or keep `$queryRaw`).
- [x] FE-FIX-03 · P0 · S — Add `loading.tsx` for `/courses/[slug]` and make `error.tsx` report the error (currently the error parameter is unused).
      Note: the skeleton streams on direct loads. On client-side navigation Next.js waits for `generateMetadata` (which fetches the course) before showing it, so with a slow API the previous page stays until the course arrives. Revisit with partial prefetching / Cache Components.
- [x] FE-FIX-04 · P1 · S — Replace the hand-written `cn` with `clsx` + `tailwind-merge` so class overrides behave predictably.
- [x] FE-FIX-05 · P1 · S — Footer uses `new Date()` during render; make sure it does not cause a hydration or caching surprise (render the year at build time or on the client).
- [x] FE-FIX-06 · P1 · S — The course search input is uncontrolled and keeps its own text when filters are cleared. Reset it when the URL query is cleared.
- [x] FE-FIX-07 · P1 · S — Pagination: scroll to the top of the results after the page changes, and move focus to the results heading for screen reader users.
- [x] FE-FIX-08 · P2 · S — Use a real web font (self-hosted via `next/font`) instead of the system font stack; pick one with good legibility for young readers.

---

## Phase 1 — Engineering foundation

- [ ] FE-OPS-01 · P0 · M — CI (GitHub Actions): install with cache, lint, typecheck, unit tests, build, and end-to-end tests against a preview stack.
- [ ] FE-OPS-02 · P0 · S — Prettier with the Tailwind class-sorting plugin; pre-commit hook (`lint-staged` + `husky` or `lefthook`).
- [x] FE-OPS-03 · P0 · M — Unit and component testing: Vitest + React Testing Library + `jest-dom`. Cover `url-state`, `api-client`, `CoursesBrowser`, `src/lib/forms` (messages, server error mapping) and the design-system components per `docs/component-test-plan.md` (FE-DS-11).
      Done: three Vitest projects (`unit`, `components` in jsdom with Testing Library + user-event + jest-dom, `api` on PostgreSQL); `npm run test:unit` needs no database. Covered: URL state, the API client, form validation messages and server-error mapping, forms (errors on submit, server field errors, summary, no double submit, POST), `CoursesBrowser` (states, URL filters, page past the end), sign-in (MFA step, unconfirmed email, class code and pictures with lock-out), social sign-in, the sample lesson, FAQ, search, server configuration and request handling. The rest of the design-system lines continue in FE-DS-11.
- [ ] FE-OPS-04 · P0 · M — End-to-end tests with Playwright: home → pick grade → course list → course detail, and the account flows listed under Testing in `docs/auth.md`, against the production build with a migrated, seeded database (emails read from the log or a memory transport). Run in CI with traces on failure.
- [ ] FE-OPS-05 · P2 · S — API mocking with MSW, only where a component test must not touch the API. End-to-end tests use the real API and database (no backend to mock any more).
- [ ] FE-OPS-06 · P1 · S — Dependabot or Renovate; `npm audit` in CI.
- [ ] FE-OPS-07 · P1 · M — Storybook (or Ladle) for UI primitives, with the accessibility addon.
- [ ] FE-OPS-08 · P1 · S — Bundle analysis script and a size budget in CI.
- [x] FE-API-01 · P0 · M — Generate TypeScript types from the backend `/openapi.json` (`openapi-typescript`) and delete the hand-written types in `features/catalog/types.ts`. (needs X-01)
      Superseded: the API is in this app, and the browser and the server import the same types (`features/auth/contract.ts`, `features/catalog/types.ts`), so the compiler checks both ends. Publish an OpenAPI document only if third parties or the mobile app need one (FE-MOB-01).
- [x] FE-API-02 · P0 · S — Validate environment variables at startup with `zod` (fail the build when `NEXT_PUBLIC_API_URL` is missing in production).
      Done: `src/server/config.ts`, checked when the server starts (`src/instrumentation.ts`); `DATABASE_URL` and, in production, `AUTH_SECRET` are required. There are no `NEXT_PUBLIC_` variables any more, and builds need none.
- [ ] FE-API-03 · P1 · M — Request ID propagation: read `X-Request-ID` from errors and show it in a "copy error details" action for support.
- [ ] FE-API-04 · P1 · M — Query key factory and cache invalidation conventions for every feature (extend the `catalogKeys` pattern); prefetch + hydrate on the server for the main list pages.
- [ ] FE-API-05 · P1 · S — Global handling for `401` (try refresh once, then redirect to sign-in) and `429` (show a friendly retry message). (needs BE-AUTH-06, BE-CORE-04)
      Partly done: 401 is handled globally (sessions slide on the server, so there is nothing to refresh; if the session really ended, sign in and come back). 429 is explained in forms; still needed for non-form requests.

---

## Phase 2 — Design system

Build the shared building blocks once so later features stay consistent. Use headless primitives (Radix UI or React Aria) for accessibility instead of writing dialogs and menus from scratch.

- [x] FE-DS-01 · P0 · M — Formalize design tokens: colors (with contrast ratios checked), type scale, spacing, radius, shadow, z-index, motion. Document in Storybook or `docs/design.md`.
- [x] FE-DS-02 · P0 · L — Core components: `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Label`, `FormField` (with error and hint), `Badge`, `Card`, `Avatar`, `Tabs`, `Tooltip`, `Dialog`, `Sheet` (mobile drawer), `DropdownMenu`, `Toast`, `Alert`, `Progress`, `Spinner`, `Breadcrumb`, `Pagination`.
- [x] FE-DS-03 · P0 · M — Forms: `react-hook-form` + `zod` resolvers, shared validation messages, server error mapping from the API's `details` array to fields.
- [x] FE-DS-04 · P0 · M — Layouts: marketing layout, app layout with sidebar (student, teacher, parent, admin variants), and a focused layout for lessons and quizzes with no distractions.
- [x] FE-DS-05 · P1 · M — Dark mode and a high-contrast theme, switchable and remembered, with no flash on load.
- [x] FE-DS-06 · P1 · M — Age-appropriate presentation: a younger variant (Grades 1–5: larger type, larger targets, more color, more illustration) and an older one (Grades 9–12: denser, calmer). Controlled by a single "grade band" theme switch from the student profile.
- [x] FE-DS-07 · P1 · M — Illustration and icon system (one consistent icon set; SVG sprite or `lucide-react`), empty-state illustrations.
- [x] FE-DS-08 · P2 · M — Motion guidelines and a small set of reusable animations (celebration on completion, progress fill). Respect `prefers-reduced-motion`.
- [ ] FE-DS-09 · P2 · S — Sound effects toggle for young learners (off by default).

### Design system review: findings

Every component was exercised in Chromium in several configurations (controlled and uncontrolled, disabled, error, nested overlays, edge values), by mouse and keyboard, in all themes and grade bands. The scenarios are listed in `docs/component-test-plan.md`.

- [x] FE-DS-10 · P0 · M — Component verification review. Fixed: `Button asChild` ignored `disabled`/`loading` (links stayed clickable); Pagination dropped keyboard focus to the page on the last page; toasts stopped auto-dismissing after one was dismissed with the mouse (Radix pause never reset); toasts could fill the screen (now at most 3); theme and band changes were lost when storage is blocked; OS dark-mode and other-tab changes were ignored on pages without a theme switcher; the mobile drawer stayed open after resizing to desktop; `?page=99` on Courses said "No courses yet"; `Select` had no placeholder (forms built their own, inconsistently); `Avatar` had no decorative mode; the browser `theme-color` ignored the chosen theme.
- [ ] FE-DS-11 · P0 · M — Automate `docs/component-test-plan.md`: component tests (with FE-OPS-03) and browser flows (with FE-OPS-04). Lines marked **R** are fixed bugs and need regression tests first.
      Done when: every line of the plan has a test in CI.
      Partly done (`tests/components/design-system.test.tsx`, `forms.test.tsx`, `catalog.test.tsx`): Button (incl. **R** asChild + disabled), FormField, PasswordInput, Checkbox, Breadcrumb, Pagination (**R** focus at the last page), the Forms section (incl. **R** POST), Courses (**R** page past the end, **R** search box follows the URL). Still to do: RadioGroup, Switch, Tabs, Tooltip, Dialog/Sheet, DropdownMenu, Toast (**R** auto-dismiss), Progress, Avatar, EmptyState, Preferences, layouts; browser-only lines (360px wrapping, forced colours, theme before paint) with FE-OPS-04.
- [ ] FE-DS-12 · P1 · S — `ConfirmDialog` on Radix AlertDialog for destructive or exit actions (delete, leave quiz): `role="alertdialog"`, no close on scrim click, focus starts on the safe action. Today those use the plain `Dialog`, whose first focus is the Close button.
- [ ] FE-DS-13 · P1 · S — Consistent field APIs: RadioGroup needs the field name twice with react-hook-form (`name` on the group for the error and `register` on each radio) — take it once; add `disabled` and `required` to RadioGroup; add `error` to Switch (Checkbox has it). Keep the `FormField` / `withFormError` pattern for all.
- [ ] FE-DS-14 · P1 · M — Toast API: `toast.dismiss(id)` and `toast.update(id)`, and an optional single action (for example "Undo") that also has a keyboard path. Today toasts can only be created.
- [ ] FE-DS-15 · P1 · S — Checkbox `indeterminate` state (select-all in rosters and the gradebook, FE-TCH-06/08).
- [ ] FE-DS-16 · P1 · M — Long forms: an error summary that lists every field error with links to the fields (shown on submit), and an "unsaved changes" warning when leaving a page or closing a dialog with edited fields.
- [ ] FE-DS-17 · P2 · S — `NumberInput` for answers and ages: `type="number"` changes value on mouse-wheel and accepts `e`, `+` and `-`; use a text input with `inputMode="numeric"` and a pattern instead.
- [ ] FE-DS-18 · P2 · S — Textarea character counter linked to the schema's maximum, announced politely near the limit.
- [ ] FE-DS-19 · P2 · S — Tooltip limits: tooltips cannot open on disabled buttons (no pointer events) and Radix closes them on scroll. Document the pattern (aria-disabled button, or the reason as visible text) and add it to `/design`.
- [ ] FE-DS-20 · P2 · M — Primitives the coming phases need, built the same way (tokens, Radix where interactive, added to `/design` and the test plan): Popover, Accordion, Combobox (searchable select), DatePicker (due dates), FileUpload (media library), Slider, DataTable (gradebook), DropdownMenu submenus, indeterminate Progress.
- [ ] FE-DS-21 · P2 · S — Localisation and right-to-left readiness: component strings are hard-coded English ("Close", "Dismiss", "Previous page", "(optional)", "Skip to main content", "Open menu", "Notifications") — move them to the i18n catalogue with FE-I18N-01. Sheet sides, the switch thumb, the select chevron and breadcrumb chevrons use physical left/right; switch to logical properties if an RTL language is planned.
- [ ] FE-DS-22 · P2 · S — Radix Toast workaround (`src/components/ui/toast.tsx`, provider remount): re-check on every Radix upgrade and remove once the pause is reset upstream.

---

## Phase 3 — Authentication and accounts

Implemented in this app, end to end (pages, API, database); see `docs/auth.md`. The shapes in `src/features/auth/contract.ts` are the real contract, shared by the browser and the server.

- [x] FE-AUTH-11 · P0 · S — Confirm the accounts contract with the backend: check the 12-point checklist in `docs/auth.md` against `/openapi.json`, fix `src/features/auth/contract.ts`, and get the classroom sign-in endpoints (class roster, picture sign-in) confirmed or added. Then generate the types (FE-API-01).
      Superseded: this app implements the contract itself (Phase 0b), including the classroom endpoints; nothing is assumed any more. The sign-in flows pass the API tests and were run in a browser against the production build.

- [x] FE-AUTH-01 · P0 · L — Auth session handling per the transport chosen in X-02 (httpOnly cookies recommended). Server-side session read in layouts, `useSession` on the client, silent refresh. (needs BE-AUTH-06)
      Done: database sessions behind an httpOnly cookie (X-02), checked in layouts (`requireUser`) and API routes (`requireAuth`), `useSession` on the client, sliding expiry with the cookie renewed by the proxy; outages never sign people out.
- [x] FE-AUTH-02 · P0 · M — Pages: sign up (with role choice), sign in, sign out, forgot password, reset password, verify email. Clear, specific error messages; no hint about whether an email exists. (needs BE-AUTH-06, BE-AUTH-07)
      Done: /sign-up (parent or teacher), /sign-in (+ MFA step), sign out, /forgot-password (no enumeration), /reset-password, /verify-email (+ resend), /confirm-email.
- [x] FE-AUTH-03 · P0 · M — Route protection with `middleware.ts` or layout guards; redirect back to the original page after sign-in; role-aware redirects after login.
      Done: `src/proxy.ts` + `(app)` layout guards, `?next=` back to the page (same-site only), role homes, wrong-role areas redirect home.
- [x] FE-AUTH-04 · P0 · M — Role-aware navigation (student, parent, teacher, admin) and a user menu.
      Done: per-role sidebar (only built pages shown), account menu with Account settings, Display settings, Sign out.
- [x] FE-AUTH-05 · P1 · M — Parent flows: add a child, link a child with a code, child switcher in the header. (needs BE-USERS-02)
      Done: add a child (with consent), link with the code a student makes, child switcher in the top bar, choose the child's sign-in (password or pictures).
- [x] FE-AUTH-06 · P1 · M — Child-friendly sign-in for Grades 1–3: class code, username, picture password. (needs BE-AUTH-10)
      Done: /sign-in/class (class code, remembered on classroom devices, name, 3 pictures, lockout after 5 tries) and /sign-in/student. Classroom sessions last one school day. Classes come from the seed until teachers can create them (BE-APP-07).
- [ ] FE-AUTH-07 · P1 · M — Parental consent screens for children under the age limit (explain clearly, in plain language). (needs BE-SEC-04)
      Partly done: a parent adding a child confirms they are the parent or guardian and agrees for the child (`parental_consent`). Still needed: consent requests sent to a parent when a school or teacher creates the account, once BE-SEC-04 defines them.
- [x] FE-AUTH-08 · P1 · M — Social sign-in buttons (Google, Microsoft, Apple). (needs BE-AUTH-11)
      Done: providers from `/auth/oauth/providers`, sign-in/sign-up and account linking/unlinking through `/auth/callback`.
- [ ] FE-AUTH-09 · P1 · M — Account settings: profile, change password, change email, language, time zone, notification preferences, active sessions, delete account and export my data. (needs BE-USERS-01, BE-SEC-05)
      Mostly done (/account, /account/security): profile, password, email change, language, time zone, active sessions, linked accounts, delete account. Still needed (no endpoints yet): notification preferences and "export my data".
- [x] FE-AUTH-10 · P2 · S — Two-factor setup screens for teachers and admins. (needs BE-AUTH-12)
      Done for every adult account: TOTP setup with a QR code drawn locally, recovery codes (shown once, download), regenerate, turn off; sign-in step accepts recovery codes.

---

## Phase 4 — Public site and discovery

- [x] FE-PUB-01 · P0 · M — Improve the landing page after real content exists: how it works, what a lesson looks like (live interactive preview), subject overview, teacher and parent sections, FAQ. Keep the grade picker as the first thing a visitor sees.
      Done (`docs/public-site.md`): grade picker first with the real course count; subjects from the database (courses and grades per subject); how it works; a working sample lesson (explain, try, feedback, done; keyboard and screen-reader friendly); parents and teachers sections with sign-up links that choose the role; safety promises; FAQ; closing call to action. Static, refreshed every 5 minutes. Replace the sample lesson with a real one after FE-STU-03.
- [x] FE-PUB-02 · P0 · M — SEO: sitemap, robots, canonical URLs, Open Graph and Twitter images per course, JSON-LD (`Course`), and meaningful `<title>` and descriptions.
      Done: `SITE_URL` (build time) for every absolute URL; canonical URLs and Open Graph / Twitter cards on every public page; `sitemap.xml` with every published course (rendered on request); `robots.txt`; share images drawn with next/og (site-wide and one per course, Lexend); JSON-LD `Course`, `EducationalOrganization`, `WebSite`; previews, staging and localhost builds are noindex. Still to do once live: submit the sitemap in Google Search Console and Bing Webmaster Tools, and check the Rich Results Test.
- [ ] FE-PUB-03 · P0 · M — Dedicated pages per grade (`/grades/4`) and per subject (`/subjects/mathematics`), statically generated with revalidation; these are the main organic entry points.
- [ ] FE-PUB-04 · P0 · M — Legal and trust pages: privacy policy (with a child-friendly summary), terms, cookie policy, safety for children, contact. Content from legal review.
      Built: /privacy (with a version for kids), /terms, /cookies (table generated from the code's cookies and storage keys), /safety (tips for kids, families and teachers; reporting a concern), /contact; linked from the footer and from the consent checkboxes. The texts are drafts written from what the code does, and every page says so.
      Done when: a lawyer has reviewed the texts; `src/config/legal.ts` has the real company, address, data location, governing law, providers, retention periods and contact addresses (and the addresses work); `reviewed: true`.
- [ ] FE-PUB-11 · P0 · S — Deleting a child's account from My children (today the privacy policy sends parents to the privacy email), and downloading a copy of a child's data (with BE-APP-10).
- [ ] FE-PUB-05 · P1 · M — Course detail upgrade: syllabus (units and lessons), prerequisites, standards covered, estimated time, preview lesson, enrol button, related courses. (needs BE-CAT-01, BE-CAT-05)
      Partly done: the course page lists its lessons in order with their length and the total time (`lessons` table, added for search). Still needed: units, prerequisites, standards, preview lesson, enrol, related courses.
- [x] FE-PUB-06 · P1 · M — Global search with instant results (command palette style) across courses and lessons. (needs BE-CAT-07)
      Done (`docs/public-site.md`, Search; `docs/backend.md`, Search): PostgreSQL full text (weighted, stemmed and as written, prefix matching while typing) with typo tolerance as a fallback (pg_trgm), subjects and grades understood; `GET /api/search`; a Ctrl+K / "/" dialog in every header (ARIA combobox, grouped results, highlighted matches, announced counts) that is a link to a server-rendered `/search` page without JavaScript; lesson results land on the lesson in the course outline. Tested at every level (unit, component, API) and in Chromium (keyboard only, 360 px dark, no JavaScript, axe).
- [ ] FE-PUB-13 · P1 · S — Search dialog on a small screen (360 × 740, dark): when the results overflow, axe reports `scrollable-region-focusable` on the results area (found while re-checking search after the move to Prisma; independent of it). Make the area reachable from the keyboard without breaking the combobox (options stay `aria-activedescendant`), or keep the results within the dialog height.
- [ ] FE-PUB-12 · P2 · S — Search follow-ups: index lesson content once lessons have it (FE-STU-03); "did you mean" suggestions; synonyms for school words (maths/math, colour/color) with a PostgreSQL thesaurus or a synonym table; a course filter for grade and subject on `/search`. Swapped letters in short words ("pyhton") aren't found today.
- [ ] FE-PUB-07 · P1 · M — Pricing page and plan comparison. (needs BE-BILL-01)
- [ ] FE-PUB-08 · P1 · M — Cookie consent banner and consent-gated analytics. (needs BE-SEC-09)
      Not needed while Lumina uses only strictly necessary storage (see /cookies). Required before adding analytics or anything optional.
- [ ] FE-PUB-09 · P2 · M — Blog / resources section for parents and teachers (MDX or headless CMS).
- [ ] FE-PUB-10 · P2 · S — Status page link and a help center link in the footer.

---

## Phase 5 — Student experience

- [ ] FE-STU-01 · P0 · L — Student dashboard: continue learning, assigned work due soon, streak and XP, recommended next courses. (needs BE-LRN-03)
- [ ] FE-STU-02 · P0 · M — "My courses" with progress bars; enrol and unenrol from a course. (needs BE-LRN-01)
- [ ] FE-STU-03 · P0 · XL — Lesson player (the core product). Split into: layout and navigation (previous/next, outline sidebar, mobile drawer); content block renderers (text, image, video, file, embed, interactive); completion handling with optimistic updates; resume where you left off. (needs BE-CAT-02, BE-LRN-02)
- [ ] FE-STU-04 · P0 · M — Video player: HLS playback, captions, speed, keyboard controls, remembers position, poster and loading states. (needs BE-MEDIA-03)
- [ ] FE-STU-05 · P0 · M — Progress sync that survives poor connections: queue updates locally and retry, de-duplicate, show a quiet "saved" indicator. (needs BE-LRN-02)
- [ ] FE-STU-06 · P1 · M — Notes and bookmarks inside lessons. (needs BE-LRN-04)
- [ ] FE-STU-07 · P1 · M — Gamification UI: streak flame, XP bar, badges shelf, level-up moment, celebration on completing a lesson or course. Optional and quieter for older grades. (needs BE-LRN-05)
- [ ] FE-STU-08 · P1 · M — Certificates page and download. (needs BE-LRN-06)
- [ ] FE-STU-09 · P1 · M — Learning path view for a grade and subject: what is done, what is next, what is locked and why. (needs BE-CAT-08)
- [ ] FE-STU-10 · P2 · M — Review queue and practice mode. (needs BE-LRN-08, BE-ASM-08)

---

## Phase 6 — Assessments UI

- [ ] FE-ASM-01 · P0 · L — Quiz player: one question at a time or all on one page (configurable), question navigator, flag for review, autosave, server-driven timer with a clear but calm countdown, submit confirmation. (needs BE-ASM-03)
- [ ] FE-ASM-02 · P0 · L — Answer inputs for each question type: multiple choice, multi-select, true/false, short answer, numeric, fill-in-the-blank, matching, ordering (drag and keyboard accessible), open response. (needs BE-ASM-01)
- [ ] FE-ASM-03 · P0 · M — Math input and display: LaTeX rendering (KaTeX) and an accessible equation editor for answers (MathLive or similar).
- [ ] FE-ASM-04 · P0 · M — Results and review screen: score, per-question feedback, explanations only when the backend allows them, retry. (needs BE-ASM-04, BE-ASM-06)
- [ ] FE-ASM-05 · P1 · M — Recover gracefully from refresh, lost connection, and expired session during an attempt; never lose typed answers.
- [ ] FE-ASM-06 · P2 · M — Practice mode UI with instant feedback and hints.

---

## Phase 7 — Teacher experience

- [ ] FE-TCH-01 · P0 · M — Teacher dashboard: my classes, items to grade, recent activity. (needs BE-SCH-02)
- [ ] FE-TCH-02 · P0 · XL — Course authoring studio: course settings; unit and lesson tree with drag-and-drop ordering (keyboard accessible); lesson editor with block types; autosave and draft/publish states; preview as student. (needs BE-CAT-01..03)
- [ ] FE-TCH-03 · P0 · L — Rich text and block editor (TipTap or Lexical) with math, images, embeds, and required alt text. Output matches the backend block schema exactly. (needs BE-CAT-02)
- [ ] FE-TCH-04 · P0 · M — Media library: upload with progress and resume, preview, captions and transcripts upload, delete with usage warning. (needs BE-MEDIA-01..03)
- [ ] FE-TCH-05 · P0 · L — Question bank and quiz builder: create and edit questions per type, tag by standard and difficulty, build quizzes from the bank. (needs BE-ASM-01, BE-ASM-02)
- [ ] FE-TCH-06 · P0 · M — Classes: create, join code, roster, add and remove students. (needs BE-SCH-02)
- [ ] FE-TCH-07 · P0 · M — Assign work to a class or to selected students with due dates; track completion per student. (needs BE-SCH-03)
- [ ] FE-TCH-08 · P0 · L — Gradebook table (sortable, filterable, keyboard navigable, handles hundreds of rows with virtualization), with CSV export. (needs BE-SCH-04)
- [ ] FE-TCH-09 · P1 · M — Grading queue for open responses with rubric, feedback, and shortcuts for speed. (needs BE-ASM-05)
- [ ] FE-TCH-10 · P1 · M — Class analytics: progress charts, struggling students, hardest questions. Charts must be readable without color alone. (needs BE-ADM-03)
- [ ] FE-TCH-11 · P1 · M — Roster import with a validation preview before committing. (needs BE-SCH-05)
- [ ] FE-TCH-12 · P2 · M — AI assist inside the editor (draft a quiz or lesson from a standard), always marked as a draft. (needs BE-AI-02)

---

## Phase 8 — Parent experience

- [ ] FE-PAR-01 · P0 · M — Parent dashboard: all children, each with progress, recent activity, upcoming work, grades. (needs BE-SCH-07)
- [ ] FE-PAR-02 · P1 · M — Child detail page: courses, time spent, strengths and areas to practice, report card download.
- [ ] FE-PAR-03 · P1 · M — Parental controls: screen-time reminders, messaging permissions, visible activity. (needs BE-NOTIF-04)
- [ ] FE-PAR-04 · P1 · M — Messaging with teachers and announcements inbox. (needs BE-NOTIF-03, BE-NOTIF-04)

---

## Phase 9 — School and platform admin

- [ ] FE-ADM-01 · P1 · M — School admin: manage teachers, students, classes, and licenses. (needs BE-SCH-01)
- [ ] FE-ADM-02 · P1 · M — Platform admin: user search, role changes, deactivate, audit log viewer. (needs BE-USERS-03, BE-AUTHZ-04)
      Partly done (/admin/users): search, role changes, turn accounts off/on, teacher verification, MFA reset, time-limited impersonation with a banner. Every action is recorded in `audit_events`. Still needed: the audit log viewer.
- [ ] FE-ADM-03 · P1 · M — Content moderation queue: review, approve, reject, take down. (needs BE-ADM-01)
- [ ] FE-ADM-04 · P2 · M — Usage and reporting dashboards for administrators. (needs BE-ADM-04)

---

## Phase 10 — Communication

- [ ] FE-COM-01 · P0 · M — Notification bell and inbox with read state; notification preferences page. (needs BE-NOTIF-01)
- [ ] FE-COM-02 · P1 · M — Realtime updates for notifications and messages (SSE or WebSocket) with polling fallback. (needs BE-NOTIF-07)
- [ ] FE-COM-03 · P1 · M — Discussion threads on lessons and classes, with report and moderation actions. (needs BE-NOTIF-05)
- [ ] FE-COM-04 · P2 · M — Web push notifications (opt-in). (needs BE-NOTIF-06)

---

## Phase 11 — Live classes (optional for first launch)

- [ ] FE-LIVE-01 · P2 · M — Schedule and calendar views (day, week), time zone aware, add to calendar (ICS). (needs BE-LIVE-01)
- [ ] FE-LIVE-02 · P2 · L — Join and in-class experience using the chosen video provider SDK, with device checks. (needs BE-LIVE-02)
- [ ] FE-LIVE-03 · P2 · S — Recordings playback inside the lesson player. (needs BE-LIVE-03)

---

## Phase 12 — Billing UI

- [ ] FE-BILL-01 · P1 · M — Checkout flow and plan selection; success and failure pages. (needs BE-BILL-02)
- [ ] FE-BILL-02 · P1 · M — Billing settings: current plan, invoices, payment method (Stripe customer portal), cancel and resume.
- [ ] FE-BILL-03 · P1 · M — Upgrade prompts at entitlement limits: say what is locked and what the plan unlocks; never block a lesson already started. (needs BE-BILL-01)
- [ ] FE-BILL-04 · P2 · M — School license request and quote flow. (needs BE-BILL-04)

---

## Phase 13 — Accessibility (ongoing, but schedule dedicated time)

Target: WCAG 2.2 AA. Students include children and learners with disabilities; this is a core requirement, not polish.

- [ ] FE-A11Y-01 · P0 · S — Add `eslint-plugin-jsx-a11y` rules (already partly included in Next's config; review) and `axe` checks in component and end-to-end tests.
- [ ] FE-A11Y-02 · P0 · M — Skip link, landmark structure, heading order, page title announcements on navigation, and focus management on route change.
- [ ] FE-A11Y-03 · P0 · M — Full keyboard operation of every interactive piece (drag-and-drop alternatives, quiz navigator, video controls, menus).
- [ ] FE-A11Y-04 · P0 · M — Screen reader pass (NVDA, VoiceOver) on the main flows: sign-in, find a course, take a lesson, take a quiz. Fix findings.
- [ ] FE-A11Y-05 · P1 · M — Reading support: dyslexia-friendly font option, adjustable text size and spacing, optional read-aloud for text blocks.
- [ ] FE-A11Y-06 · P1 · S — Color contrast audit for every theme, including grade-band colors (yellow on white fails; check the marker color usage).
- [ ] FE-A11Y-07 · P1 · S — Captions and transcripts always available for video; warn authors when missing.
- [ ] FE-A11Y-08 · P2 · M — Independent accessibility audit before public launch.

---

## Phase 14 — Internationalization

- [ ] FE-I18N-01 · P1 · L — Introduce `next-intl` (or equivalent): locale routing, message catalogs, pluralization, date/number formatting. Move all user-facing strings out of components. Do this early; retrofitting is expensive.
- [ ] FE-I18N-02 · P1 · M — Language switcher; remember the choice in the profile and a cookie.
- [ ] FE-I18N-03 · P2 · M — Right-to-left layout support (use logical CSS properties: `ms-*`, `ps-*`).
- [ ] FE-I18N-04 · P2 · M — Localized content from the API (`Accept-Language`); localized SEO (`hreflang`). (needs BE-CAT-09)

---

## Phase 15 — Performance and quality

- [ ] FE-PERF-01 · P0 · M — Core Web Vitals budget (LCP < 2.5 s, INP < 200 ms, CLS < 0.1) on mid-range phones over a slow network. Lighthouse CI on key pages.
- [ ] FE-PERF-02 · P0 · M — Image handling with `next/image`, responsive sizes, modern formats, and a CDN loader.
- [ ] FE-PERF-03 · P1 · M — Caching strategy: static + revalidate for public pages; `revalidatePath` / `revalidateTag` from the publish action itself (same app, no webhook needed).
- [ ] FE-PERF-04 · P1 · M — Route-level code splitting for heavy features (editor, video player, charts); lazy load below-the-fold widgets.
- [ ] FE-PERF-05 · P1 · M — Real-user monitoring (Web Vitals reporting) and error tracking (Sentry) with source maps. Do not send personal data about children.
- [ ] FE-PERF-06 · P1 · S — Make heavy tables and lists virtualized (gradebook, rosters, question bank).
- [ ] FE-QA-01 · P1 · M — Visual regression tests for key components and pages (Playwright screenshots or Chromatic).
- [ ] FE-QA-02 · P1 · M — Cross-browser and device matrix (Chrome, Safari including iOS, Firefox, low-end Android, school-issued Chromebooks).
- [ ] FE-QA-03 · P2 · M — Test with network throttling and offline conditions; verify graceful behavior.

---

## Phase 16 — Offline, PWA, and mobile preparation

- [ ] FE-PWA-01 · P2 · M — Web app manifest and install prompt; app icons.
- [ ] FE-PWA-02 · P2 · L — Service worker: cache app shell and downloaded lessons; offline-safe progress queue (shares logic with FE-STU-05). (needs BE-MOB-02)
- [ ] FE-MOB-01 · P1 · L — Convert to a workspace monorepo (`apps/web`, `apps/mobile`, `packages/*`) before the mobile app starts. Extract shared `api-client`, the contract types, validation schemas, and design tokens into packages. The mobile app can't use cookies the same way: add bearer sessions (same `sessions` table, `Authorization` header) for it.
- [ ] FE-MOB-02 · P1 · M — Keep business logic (hooks, state, formatters) free of DOM and Next.js imports so React Native can reuse it.
- [ ] FE-MOB-03 · P2 · M — Deep link scheme and universal links plan (`/courses/[slug]`, `/lessons/[id]`).

---

## Phase 17 — Security and privacy (frontend side)

- [ ] FE-SEC-01 · P0 · M — Content Security Policy (nonce-based), plus the headers already set in `next.config.ts` (add HSTS, Permissions-Policy). Test that embeds and video still work.
- [ ] FE-SEC-02 · P0 · M — Sanitize all rendered rich content (DOMPurify or server-side sanitization); never use `dangerouslySetInnerHTML` without it. Add a test with malicious payloads.
- [x] FE-SEC-03 · P0 · S — Keep tokens out of `localStorage`. Follow the transport decision in X-02; protect state-changing requests against CSRF if cookies are used.
      Done: the session token lives only in an httpOnly cookie (the database keeps its hash); CSRF: SameSite=Lax + Origin check + app header on every state-changing request; forms POST so early submits never put passwords in URLs.
- [ ] FE-SEC-04 · P0 · M — Third-party scripts policy for a children's product: no ad or tracking scripts, analytics only with consent, self-host where possible, review each addition.
- [ ] FE-SEC-05 · P1 · S — Dependency review: pin versions, run `npm audit` and license checks in CI.
- [ ] FE-SEC-06 · P1 · S — Do not render or log personal data of children in client error reports or analytics.

---

## Phase 18 — Deployment

- [ ] FE-DEP-01 · P0 · M — Choose hosting (Vercel, or containers) with a managed PostgreSQL (backups, point-in-time recovery), and set up preview deployments for every pull request, each with its own database (or branch) migrated on deploy.
- [ ] FE-DEP-02 · P0 · M — Environments (preview, staging, production) with their own environment variables; no secrets in `NEXT_PUBLIC_*`.
- [ ] FE-DEP-03 · P1 · S — Custom domain, HTTPS, redirects (www, trailing slash), and a maintenance page.
- [ ] FE-DEP-04 · P1 · M — Feature flags on the client (matching the backend choice, BE-INFRA-05) for gradual rollouts.
- [ ] FE-DEP-05 · P1 · S — Release process: versioning, changelog, and rollback steps in `docs/release.md`.

---

## Former cross-project contracts

These kept a separate backend and this app in step. With the backend inside this app they are settled:

- [x] X-01 · P0 · S — Backend publishes OpenAPI; this app generates types from it (FE-API-01).
      Superseded: shared TypeScript types (FE-API-01).
- [x] X-02 · P0 · M — Decide browser auth transport (cookies vs bearer) and record it in an ADR. It decides FE-AUTH-01 and FE-SEC-03.
      Decided: database sessions behind an httpOnly cookie (docs/auth.md). Bearer sessions only for a future mobile app (FE-MOB-01).
- [x] X-03 · P0 · S — Error envelope codes and validation `details` shape are documented; form components map `details[].field` to inputs.
      Done: `src/server/http` (docs/backend.md), codes listed in docs/auth.md.
- [x] X-04 · P1 · S — CORS and cookie settings per environment.
      Done: no CORS (the browser only calls its own origin); cookies follow the protocol, `COOKIE_SECURE` overrides.
- [x] X-05 · P1 · M — Signed revalidation webhook from backend to frontend on content publish (FE-PERF-03).
      Superseded: publishing happens in this app and revalidates directly (FE-PERF-03).

---

## Suggested order for a first public launch

1. Phase 0 → Phase 1 → Phase 2 (fixes, tooling, design system)
2. Phase 3 (accounts), in step with backend Phase 2
3. Phase 4 (public site, SEO) → Phase 5 (student lessons) → Phase 6 (quizzes)
4. Phase 7 (teacher authoring and gradebook) → Phase 8 (parents)
5. Phase 13 (accessibility), 15 (performance), 17 (security), 18 (deployment): start early, finish before launch
6. Soft launch with a few schools → then Phases 9, 10, 12, 14, 16 → later Phase 11
