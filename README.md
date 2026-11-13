# Lumina

Lumina is a learning platform for Grades 1 to 12. This repository is the whole application: pages, API and database access in **one Next.js app** on **PostgreSQL**. It has the public site (home page with the grade picker, subjects and a sample lesson; a searchable course list and a page per course; privacy, terms, cookies, children's safety and contact pages), and accounts for students, parents, teachers and admins.

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
| Student | username `leo10` at `/sign-in/student` |
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
| `tests/unit` | Pure logic: validation and messages, URL state, the API client, search query parsing, server configuration, request validation, the error envelope, security helpers, the legal pages | Nothing |
| `tests/components` | React components rendered in jsdom with Testing Library and user-event: the design system (lines of `docs/component-test-plan.md`, including the **R** regressions), forms, the course browser, sign-in (email, MFA, class pictures), the sample lesson, global search | Nothing |
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
| `npm test` fails to connect | Run it in Docker (`make test`), or make PostgreSQL available at `TEST_DATABASE_URL` (default `postgres://lumina:lumina@localhost:5432/lumina_test`) with permission to create that database. |

## API

This app's own API, under `/api`. Request and response types are shared with the browser code in `src/features/auth/contract.ts` and `src/features/catalog/types.ts`. Errors use one envelope, `{"error": {"code", "message", "details", "request_id"}}`; `details[].field` (e.g. `body.email`) puts a message next to that form field.

| Area | Endpoints |
| --- | --- |
| Catalog (public) | `GET /api/courses` (`grade_level`, `subject`, `q`, `limit`, `offset`), `GET /api/courses/slug/{slug}`, `GET /api/subjects` |
| Search (public) | `GET /api/search?q=…&limit=5`: courses and lessons, instant (prefix) matching, typo tolerance, grades ("grade 4") |
| Sign-in and sign-up | `/api/auth/*`: register, verify email, login (email, username, MFA step, class pictures), class roster, OAuth, logout, password reset, email change confirmation |
| Own account | `/api/session`, `/api/me/*`: profile, password, email, sessions, two-step verification, linked accounts, teacher profile, children, link codes |
| Administration | `/api/admin/users/*`, `/api/impersonation` |
| Operations | `GET /api/health` (200 when the database answers) |

The full list with rules for each endpoint is in [`docs/auth.md`](docs/auth.md) and [`docs/backend.md`](docs/backend.md).

## Project structure

Feature-based: routes stay thin, each business area owns its code, and everything server-side lives in `src/server`.

```
compose.yaml                 development stack: db, mail (Mailpit), app (next dev, hot reload)
compose.prod.yaml            production-like stack: built image, migrations as a one-off job
Dockerfile                   targets: dev, runner (production, default), migrator
prisma/                      schema.prisma (tables, relations, indexes) and migrations/ (SQL, commit them)
prisma.config.ts             Prisma CLI configuration (schema and migrations paths, DATABASE_URL)
scripts/                     db-migrate (+ lib/migrations.ts), db-seed, contrast check; docker/dev-entrypoint.sh (app container start-up)
tests/                       Vitest: unit/ (pure logic), components/ (React, jsdom), api/ (Route Handlers on a real database), support/
src/
├── app/
│   ├── (marketing)/         public pages: home, courses, search, privacy, terms, cookies, safety, contact
│   ├── sitemap.ts · robots.ts · opengraph-image.tsx   SEO files (course pages have their own share image)
│   ├── (auth)/              sign-in (email, student, class code + pictures), sign-up, password and email links
│   ├── (app)/               signed-in areas: learn, teach, family, admin, account
│   ├── api/                 the API: one Route Handler per endpoint (thin: parse, call a service, answer)
│   ├── auth/                OAuth callback, session recovery
│   ├── (dev)/design/        design system reference, development only
│   └── layout.tsx …         root layout, providers, fonts, global styles, not-found and error
├── server/                  server-only code (never in the browser bundle)
│   ├── db/                  the Prisma Client (getDb), row types, database error helpers
│   ├── http/                route wrapper, error envelope, validation, CSRF, rate limits
│   ├── auth/                sessions, cookies, passwords, TOTP, one-time tokens, sign-in services
│   ├── accounts/ · family/ · admin/ · catalog/ · oauth/ · search/   domain services
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
│   ├── account/ · family/ · admin/   account settings, children, user administration
│   └── design-system/       the /design reference page
├── components/              ui/, forms/, layout/, theme/, illustrations/, feedback/
├── generated/prisma/        the generated Prisma Client (not committed; `npm install` creates it)
├── styles/tokens.css        design tokens: colours per theme, grade bands, z-index, motion
├── lib/                     API client, preferences, forms, cn, formatting, safe redirects
└── hooks/ · config/         shared hooks; site, legal (company details for the policies) and navigation config
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
- **Errors**: the API answers every error in one envelope with a request id; the browser's API client turns it into a typed `ApiError`. An unreachable database is a 503 ("try again"), never a sign-out. The error page logs the error and shows its reference (`digest`) to quote to support.
- **Design tokens only**: components use semantic colours (`bg-surface`, `text-fg-muted`); Tailwind's default palette is switched off so a theme can change everything in one place. Contrast is checked by `npm run tokens:check`.
- **Themes and reading level**: light, dark and high contrast, plus a grade band (Grades 1–5, 6–8, 9–12) that changes text size, target size and density. Both are remembered on the device and applied by a small inline script before the page paints, so there is no flash.
- **Font**: Lexend, chosen for legibility for young readers, is self-hosted from `src/app/fonts/` through `next/font/local` (SIL OFL 1.1). Builds do not need internet access to Google Fonts.
- **Class names**: `cn()` combines `clsx` and `tailwind-merge`, so a class passed in by the caller overrides a conflicting default (for example `shadow-none` over `shadow-sticker`).
- **Footer year**: fixed at build time, so static and server-rendered pages always agree.

## Roadmap

The task-by-task plan, with priorities, sizes and acceptance criteria, is in [`TODO.md`](TODO.md).
