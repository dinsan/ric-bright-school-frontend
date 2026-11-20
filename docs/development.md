# Development reference

> Commands, tests, the design system and troubleshooting, moved verbatim from the README. The README keeps the short version.

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

The formula engine (Python) has its own pytest suite in `services/formula-engine/tests` (`make engine-test`), including a test that solves every worked example of the formula catalog.

`npm run test:unit` runs the first two in seconds on any machine; `npm test` runs everything. Component tests use `renderWithProviders` and `mockApi` (`tests/support/render.tsx`) and a stand-in for `next/navigation` (`tests/support/next-navigation.ts`); API tests use `Browser` and the factories in `tests/support`. When you build a feature, add tests at the level that checks it best: rules in `unit`, behaviour people see in `components`, the server's answers in `api`.

## Design system

Tokens, components, layouts, themes and the age-appropriate "grade band" presentation are documented in
[`docs/design.md`](design.md). While `npm run dev` is running, open **http://localhost:3000/design** to see
everything live, switch theme (light, dark, high contrast) and reading level (Grades 1–5, 6–8, 9–12), and try the
layouts and a working form. That page exists in development only. The behaviour each component must keep is listed
in [`docs/component-test-plan.md`](component-test-plan.md).

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

## Setup in full (from the original README)

> The README has the short version. Note: `.env.example`, mentioned below, doesn't exist yet (task SS-02 in [`self-study-plan.md`](self-study-plan.md)); the variables are listed under Configuration.

### Quick start

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
| **http://localhost:8000/docs** | The formula engine's API (what the formula calculator uses) |

`docker compose up` starts four containers (`compose.yaml`): **db** (PostgreSQL 16), **mail** (Mailpit), **formula-engine** (the Python formula calculator, hot reload) and **app** (`next dev` on your checkout, which is mounted into the container). Each time the app container starts it installs dependencies if `package-lock.json` changed, applies new migrations, and adds the sample courses, the formula library and demo accounts if they are missing. All demo accounts use the password `lumina-demo-password`:

| Who | Sign in with |
| --- | --- |
| Student (one course finished, with a certificate, three goals) | username `leo10` at `/sign-in/student` |
| Young student | family code `SUNNY7`, then Maya, then the pictures cat, sun, tree at `/sign-in/pictures` |
| Parent (children Maya and Leo) | `parent@lumina.test` at `/sign-in/parent` |
| Admin | `admin@lumina.test` at `/sign-in/staff` |

#### Everyday commands

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

#### Without Docker

With **Node.js 22** (20.9 or newer) and **PostgreSQL 14+** on your machine:

```bash
npm ci                       # also generates the Prisma Client (src/generated/prisma)
cp .env.example .env.local   # DATABASE_URL points at localhost:5432
make db                      # optional: PostgreSQL, Mailpit and the formula engine in Docker
npm run db:migrate && npm run db:seed
npm run dev
```

Without `SMTP_URL`, emails are printed in the terminal; with `SMTP_URL=smtp://localhost:1025` (and `make db`) they go to Mailpit.

The formula calculator needs the formula engine: `docker compose up -d formula-engine` (or run it with Python 3.12, see
[its README](../services/formula-engine/README.md)) and `FORMULA_ENGINE_URL=http://localhost:8000` in `.env.local`.

### Run in production mode

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

### Configuration

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
| `FORMULA_ENGINE_URL` | off | The formula engine (`services/formula-engine`), e.g. `http://formula-engine:8000` (Docker sets it). Without it, formula pages show formulas as LaTeX text and the calculator says it isn't available |
| `FORMULA_ENGINE_KEY` | none | Sent as `Authorization: Bearer …` when the engine requires a key (its `ENGINE_API_KEY`; `compose.prod.yaml` passes `ENGINE_API_KEY` from `.env` to both) |

Register `<APP_URL>/auth/callback` as the redirect URI with each social sign-in provider.

## Project structure in detail (from the original README)

Feature-based: routes stay thin, each business area owns its code, and everything server-side lives in `src/server`.

```
compose.yaml                 development stack: db, mail (Mailpit), formula-engine (hot reload), app (next dev, hot reload)
compose.prod.yaml            production-like stack: built image, migrations as a one-off job
Dockerfile                   targets: dev, runner (production, default), migrator
prisma/                      schema.prisma (tables, relations, indexes) and migrations/ (SQL, commit them)
public/media/                lesson media served as static files (sample video as HLS + MP4, captions, images, worksheets)
prisma.config.ts             Prisma CLI configuration (schema and migrations paths, DATABASE_URL)
scripts/                     db-migrate (+ lib/migrations.ts), db-seed (+ seed-lessons, seed-content, seed-quizzes, seed-formulas; data/formulas.json), contrast check; docker/dev-entrypoint.sh (app container start-up)
services/formula-engine/     the formula engine: a separate Python project (SymPy, NumPy, SciPy, FastAPI), its own Dockerfile and tests
tests/                       Vitest: unit/ (pure logic), components/ (React, jsdom), api/ (Route Handlers on a real database), support/
src/
├── app/
│   ├── (marketing)/         public pages: home, courses, grades, subjects (with their formula library), pricing, search, help centre (/help), privacy, terms, cookies, safety, contact
│   ├── sitemap.ts · robots.ts · opengraph-image.tsx   SEO files (course pages have their own share image)
│   ├── (auth)/              sign-in: the chooser, student (username; family code + pictures), parent and staff pages; sign-up (parents); password and email links
│   ├── (app)/               signed-in areas in the app shell: learn, family, admin, account
│   ├── (focus)/             signed-in pages without the app shell: the lesson player, review sessions, quizzes
│   ├── api/                 the API: one Route Handler per endpoint (thin: parse, call a service, answer)
│   ├── auth/                OAuth callback, session recovery
│   ├── (dev)/design/        design system reference, development only
│   └── layout.tsx …         root layout, providers, fonts, global styles, not-found and error
├── server/                  server-only code (never in the browser bundle)
│   ├── db/                  the Prisma Client (getDb), row types, database error helpers
│   ├── http/                route wrapper, error envelope, validation, CSRF, rate limits
│   ├── auth/                sessions, cookies, passwords, TOTP, one-time tokens, sign-in services
│   ├── accounts/ · family/ · admin/ · catalog/ · oauth/ · search/   domain services
│   ├── learning/            students' enrolments, progress, lessons, paths, review, quizzes, badges, certificates (+ PDF)
│   ├── goals/               goals parents set: the parent API, the student's goals, goals met (checkGoals)
│   ├── formulas/            the formula library and the formula engine's client
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
│   ├── goals/               goals: contract, pure rules (shared by both sides), goal card, student and parent screens
│   ├── help/                help for the whole product: topics and search (topics.ts), the words (content/: everyone, student, parent, staff; meta.ts), the ? button's panel, the help centre pages
│   ├── account/ · family/ · admin/   account settings; children, their progress, reports, controls and the family code; user and course-price administration
│   ├── formulas/            formula library: shapes, MathML allowlist, calculator, MathML and formula components
│   └── design-system/       the /design reference page
├── components/              ui/, forms/, layout/, theme/, illustrations/, feedback/
├── generated/prisma/        the generated Prisma Client (not committed; `npm install` creates it)
├── styles/tokens.css        design tokens: colours per theme, grade bands, z-index, motion
├── lib/                     API client, preferences, forms, cn, formatting, safe redirects
└── hooks/ · config/         shared hooks (preferences, debounce, visible time); site, legal and navigation config
```
