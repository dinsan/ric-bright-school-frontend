# The backend inside the app

Lumina is one Next.js application: pages, API and database access are built, tested and deployed together.
This document explains how the server side is organised and how to extend it. Sessions and sign-in have
their own document: [`auth.md`](auth.md).

## Shape

```
Browser ──fetch /api/…──▶ Route Handler (src/app/api/…/route.ts) ──▶ service (src/server/…) ──▶ Prisma Client ──▶ PostgreSQL
Browser ──page request──▶ Server Component / layout ───────────────▶ service (no HTTP)    ──▶ Prisma Client ──▶ PostgreSQL
```

- **Route Handlers** (`src/app/api`) are thin: parse the input, check who is asking, call a service, answer.
  One folder per endpoint, following the paths in `src/features/auth/contract.ts`.
- **Services** (`src/server/<area>/service.ts`) hold the rules: validation schemas (zod), permissions,
  queries, side effects (email, audit). They throw `HttpError` for anything the caller should see.
- **Server Components** call services directly (e.g. the course page uses `getCourseBySlug`; layouts use
  `requireUser`). The browser never imports from `src/server`: its modules start with `import "server-only"`,
  so Next.js refuses to bundle them for the client. The exceptions are the few the Node scripts
  (`scripts/db-*.ts`) also load: `config.ts`, `db/`, `auth/password.ts`.
- **Shared types**: the JSON shapes live in `src/features/auth/contract.ts` and `src/features/catalog/types.ts`;
  serializers (`src/server/accounts/serializers.ts`, `toCourse` in the catalog service) turn database rows into
  them. Both sides import the same types.

| Folder | What |
| --- | --- |
| `src/server/config.ts` | Environment, validated with zod once (and at server start by `src/instrumentation.ts`) |
| `prisma/schema.prisma` | Every table, relation and index (the source of truth for the client and for migrations) |
| `prisma/migrations/` | SQL migrations, applied in order by `prisma migrate deploy` (commit them) |
| `prisma.config.ts` | Prisma CLI settings: schema and migrations paths, `DATABASE_URL` (read from the same env files as Next.js) |
| `src/server/db/index.ts` | `getDb()`: the Prisma Client (created on first use; `next build` never connects), row types, error helpers (`isDatabaseUnavailable`, `isUniqueViolation`), `escapeLike` |
| `src/generated/prisma/` | The generated Prisma Client (not committed; `npm install` / `npm run db:client` create it) |
| `src/server/http/` | `route()` wrapper, `HttpError`, `parseBody` / `parseQuery` / `parseId`, CSRF check, client IP, rate limits |
| `src/server/auth/` | Sessions, cookies, passwords (argon2id), TOTP, one-time tokens, sign-in services |
| `src/server/accounts/`, `family/`, `admin/`, `catalog/`, `oauth/`, `search/` | Domain services |
| `src/server/mail/` | Email transport (SMTP, log, memory) and templates |
| `src/server/audit.ts` | Audit trail of admin and security-relevant actions |
| `src/server/build-phase.ts` | `withBuildFallback`: prerendered pages read the database during `next build` only when it is configured and reachable |

## A request, step by step

`route()` (`src/server/http/route.ts`) wraps every handler:

1. Refuses a cross-site state-changing request (403 `cross_site_request`).
2. Runs the handler. Typical handler:

   ```ts
   export const PATCH = route(async (request: NextRequest) => {
     const auth = await requireAuth(request);                       // 401 / 403
     const input = await parseBody(request, profileInput);          // 422 with details[].field = "body.…"
     return json(await updateProfile(auth, input));
   });
   ```

3. Turns errors into the envelope `{ error: { code, message, details, request_id } }`: `HttpError` as it is;
   a database that can't be reached as 503 `service_unavailable` (with `Retry-After`); anything else is
   logged with the request id and answered as 500 without internals.
4. Sets `X-Request-ID` (taken from the request when a proxy sends one) and `Cache-Control: no-store` unless
   the handler chose otherwise (the public catalog is cacheable for a minute).

Messages follow the product's writing rules (`src/lib/forms/messages.ts`): they say what to do, in plain words.
Validation uses the same friendly messages as the browser forms (`friendlyErrorMap`).

## Database

PostgreSQL 16 with [Prisma ORM 7](https://www.prisma.io/docs). The schema is `prisma/schema.prisma`; the typed
client generated from it lives in `src/generated/prisma` and is used through `getDb()` from `src/server/db`.
Prisma 7 runs queries in TypeScript/WebAssembly over node-postgres (the `@prisma/adapter-pg` driver adapter): there
is no Rust query engine binary at runtime, so the standalone Docker image stays small. Only the Prisma CLI
(migrations, `prisma generate`, Studio), a dev dependency, uses a native schema engine.

Tables:

| Table (model) | What |
| --- | --- |
| `users` (`User`) | Every account (role, name, email/username, password and picture hashes, MFA, lockout, parent's active child) |
| `teacher_profiles` (`TeacherProfile`) | School, subjects, grades, bio, verification by an admin |
| `guardianships` (`Guardianship`) | Parent ↔ child, with the time consent was given |
| `sessions` (`Session`) | Server-side sessions (hashed token, kind, device, IP, expiry, impersonating admin) |
| `auth_tokens` (`AuthToken`) | One-time tokens: email verification, password reset, email change, MFA step, parent link codes, OAuth state |
| `recovery_codes` (`RecoveryCode`) | MFA recovery codes (hashed, single use) |
| `oauth_accounts` (`OAuthAccount`) | Linked Google / Microsoft / Apple identities |
| `classes`, `class_members` (`Class`, `ClassMember`) | A teacher's classes and their students (class codes for picture sign-in) |
| `subjects`, `courses`, `lessons` (`Subject`, `Course`, `Lesson`) | The catalog; only `published` courses (and their lessons) are public. Courses and lessons have a generated, weighted full-text `search_vector` |
| `audit_events` (`AuditEvent`) | Admin actions, impersonation, password/email/MFA changes, deletions |
| `rate_limits` (`RateLimit`) | Fixed-window counters shared by every server instance |

Conventions: models are PascalCase and fields camelCase in TypeScript, mapped (`@map` / `@@map`) to snake_case
tables and columns in the database. UUID keys (`gen_random_uuid()`), `timestamptz`, emails and usernames stored
lower-case (checked by constraints), secrets only hashed or encrypted, foreign keys with explicit `ON DELETE`
(deleting an account removes its sessions, tokens and links; audit rows keep the event with the actor set to
null). Constraint and index names are explicit (`map: "…"`), so they don't change with Prisma's naming rules.

### Writing queries

```ts
import { getDb, isUniqueViolation } from "@/server/db";

const user = await getDb().user.findUnique({ where: { email } });
const sessions = await getDb().session.findMany({ where: { userId, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } });
await getDb().$transaction(async (tx) => { /* tx.user…, tx.guardianship… */ });
```

- **Row types**: `UserRow`, `SessionRow`, `CourseRow`… are re-exported from `@/server/db` (Prisma's model types).
  Helpers that may run inside a transaction take an `Executor` (`db` or `tx`), like `audit()`.
- **Atomic updates**: "update only if still valid" is one statement with the condition in `where`:
  `updateMany` (returns a count) or `updateManyAndReturn` (returns the rows), e.g. consuming a one-time token.
  When the new value depends on the stored one in ways Prisma can't express (lockout counters, rate limits), the
  code uses `$queryRaw` with an `UPDATE … RETURNING` / `INSERT … ON CONFLICT` (see `recordFailedSignIn`,
  `hitRateLimit`).
- **Raw SQL**: always the tagged template (`$queryRaw\`… ${value}\``, `Prisma.sql`, `Prisma.join`): values become
  bound parameters. Never `$queryRawUnsafe` with user input. Raw results use the database's column names
  (snake_case), so give them an explicit row type.
- **LIKE searches**: Prisma's `contains` / `startsWith` don't escape `%` and `_`: wrap user text in
  `escapeLike()` (the catalog and admin searches do), with `mode: "insensitive"` for ILIKE.
- **"Insert if missing"**: `createMany({ data, skipDuplicates: true })` is `INSERT … ON CONFLICT DO NOTHING`;
  `upsert` with the same unique key in `where` and `create` becomes a native `INSERT … ON CONFLICT DO UPDATE`.
- **Errors**: `isUniqueViolation(error)` for duplicates (Prisma `P2002`, or SQLSTATE 23505 from raw SQL),
  `pgErrorCode(error)` for other PostgreSQL codes, `isDatabaseUnavailable(error)` for outages (the `route()`
  wrapper answers 503). They read the driver error Prisma keeps in `error.meta.driverAdapterError`.

### Changing the schema

1. Edit `prisma/schema.prisma`.
2. `npm run db:generate -- --name add_something` (Docker: `make db-generate NAME=add_something`) writes the next
   migration, `prisma/migrations/<timestamp>_add_something/migration.sql`, without applying it. It needs a
   database to compare with (the development one) and creates a temporary "shadow" database, so the database user
   needs the `CREATEDB` right (the Docker one has it).
3. Read the SQL. Renames can come out as drop + add: edit the file if needed. Add by hand what `schema.prisma`
   can't express (see below).
4. `npm run db:migrate` applies it, and `npm run db:client` regenerates the client (Prisma 7's `migrate dev` no
   longer does; `next dev` picks up the new client without a restart). `npm test` runs the suite on a freshly
   migrated test database. `npm run db:check` confirms the database now matches the schema.
5. Commit the schema change and the migration together. Deployments run the `migrator` image (or
   `npm run db:migrate`) before starting the new version; applied migrations are recorded in `_prisma_migrations`
   and never applied twice. Never edit a migration that has been applied anywhere: add a new one.

Write migrations so the previous version of the app keeps working while they run (add columns as nullable or
with defaults, backfill, then tighten in a later release).

**Not expressible in `schema.prisma`**, so written by hand in migration SQL (marked "Not in schema.prisma" in
`20261112000000_init`). Prisma's diff ignores these, so they never show up as drift, but nothing regenerates them
either: keep them in mind when you change the tables they belong to.

| What | Where |
| --- | --- |
| `CREATE EXTENSION pg_trgm` | Trigram indexes for typo-tolerant search |
| `CHECK` constraints | Lower-case emails and usernames, grades 1–12, lesson position and duration |
| Generated `search_vector` columns (`GENERATED ALWAYS AS … STORED`) | `schema.prisma` declares them `Unsupported("tsvector")` with the generation expression as `@default(dbgenerated(…))`, which tells Prisma the column is computed. If you change the expression, change both. Prisma Client doesn't read or write these columns; search uses raw SQL |
| `NOT NULL` on `teacher_profiles.subjects` / `grade_levels` | Prisma can't mark list columns required |

### Databases created before Prisma

Before the move to Prisma, the schema was managed with Drizzle ORM (migrations `drizzle/0000–0002`). The Prisma
baseline migration `20261112000000_init` creates exactly the same structure (same names; checked with `prisma
migrate diff`), so `npm run db:migrate` adopts an existing database without touching its data: when it finds
`drizzle.__drizzle_migrations` and no `_prisma_migrations`, it marks the baseline as applied (`prisma migrate
resolve --applied`) and drops the `drizzle` bookkeeping schema (`scripts/lib/migrations.ts`). A database on which
not all Drizzle migrations were applied is refused with a message; recreate it (development data only). The API
tests simply recreate their own database. What changed in the move, and how it was verified:
[`prisma-migration.md`](prisma-migration.md).

## Adding an endpoint

1. Add the request/response types to the contract (`src/features/auth/contract.ts`, or the feature's `types.ts`)
   and the path to `paths`.
2. Write the service function with its zod input schema in `src/server/<area>/service.ts`. Check permissions
   there (roles, ownership: "is this one of this parent's children?"). Throw `HttpError` / `fieldError`.
3. Add `src/app/api/<path>/route.ts` using `route()`, `requireAuth`, `parseBody` / `parseQuery` / `parseId`.
4. Call it from the browser through the feature's `api.ts` with `apiFetch` (never `fetch` directly).
5. Add an integration test in `tests/api` (see "Tests" below).

## Security notes

- **Passwords**: argon2id (19 MiB, 2 passes), parameters stored in the hash. Picture passwords are hashed the
  same way (they have little entropy, so the 5-try lockout matters more than the hash).
- **Tokens**: sessions and one-time tokens are 256-bit random values; short codes people type (parent link
  codes, 8 characters without look-alikes) are one-time, expire, and are rate-limited.
- **Secrets at rest**: TOTP secrets are encrypted with AES-256-GCM under a key derived (HKDF) from `AUTH_SECRET`.
- **Rate limits** key on the client IP from `X-Forwarded-For` (or `X-Real-IP`). Run the app behind a proxy or load
  balancer that sets it (and strips values sent by clients); otherwise per-IP limits can be sidestepped. Without
  either header the per-IP limits are skipped rather than shared by every visitor (which would let one busy
  classroom lock out the whole site). Per-account lockouts don't depend on the IP.
- **Audit**: `audit_events` records admin actions and security changes; there is no viewer yet (FE-ADM-02).
- **Headers**: `next.config.ts` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`;
  CSP and HSTS are still to do (FE-SEC-01).

## Operations

- **Health**: `GET /api/health` is 200 when the database answers, 503 otherwise (the Docker healthcheck uses it).
- **Connection pool**: `DATABASE_POOL_MAX` per server process (default 10). With several instances, keep the total
  under the database's `max_connections`, or put PgBouncer (transaction mode) in front.
- **Email**: set `SMTP_URL` in every deployed environment; without it, emails only go to the log. Emails are sent
  after the response (`after()` from `next/server`), so a slow mail server never slows a request.
- **Housekeeping**: expired sessions, tokens and old rate-limit counters are deleted opportunistically during
  normal traffic; no cron job is needed.
- **Backups**: the database is the only state. Back it up (and test restores); `AUTH_SECRET` must be kept with it,
  or authenticator apps stop working after a restore.

## Search

`src/server/search/service.ts`, behind `GET /api/search`. PostgreSQL does the work, no search server:

- Courses and lessons have a generated `search_vector` column (defined in the baseline migration's SQL, declared
  `Unsupported("tsvector")` in `schema.prisma`): title weighted A, summary B, description C, each indexed with
  English stemming and as written (`english` and `simple` configurations). GIN indexes on the vectors; trigram
  (`pg_trgm`) GIN indexes on titles.
- The queries are raw SQL (`$queryRaw` with `Prisma.sql` fragments, so every value is a bound parameter): Prisma's
  query API has no tsquery, ranking or trigram operators.
- Every word of the query is a prefix and all are required (`frac` finds "Fractions"). Subject names count; a
  grade ("grade 4", "4th grade", "g4") is a filter. Lessons also match their course's title, at the lowest weight.
- Typo tolerance (`word_similarity` ≥ 0.4 on titles) runs only when nothing matches exactly, and marks the
  results `approximate`: on its own, trigram similarity also matches unrelated titles ("fraction" ~ "subtraction").
- Query parsing (`src/features/search/query.ts`) is shared with the browser, which uses it to highlight matches.
  It keeps only letters and digits, so the tsquery built from it can't be malformed.
- Public and cacheable for a minute. If the catalog grows to tens of thousands of lessons, store the course title
  in the lesson's vector instead of joining it per query.

## Tests

Vitest with three projects (`vitest.config.mts`): `unit` (pure logic, no database), `components` (React in jsdom
with Testing Library) and `api`. `npm run test:unit` runs the first two in seconds; `npm test` runs all three.

The `api` project creates `lumina_test` if needed, applies the migrations (`prisma migrate deploy`; a test database
left over from the Drizzle version is recreated), and truncates every table before each test. Tests call the Route
Handlers as the browser would, through `tests/support/browser.ts` (keeps cookies, sends the CSRF header), and read
emails from the in-memory outbox (`tokenFromEmail`). Factories in `tests/support/factories.ts` create users,
classes and a small catalog (with lessons) directly in the database.

```ts
const browser = new Browser();
await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password: PASSWORD } });
const response = await browser.call(listChildren, { path: "/api/me/children" });
expect(response.status).toBe(200);
```

Component tests render with `renderWithProviders` (TanStack Query, tooltips, toasts; returns a `user` from
user-event), answer API calls with `mockApi({ "GET /api/courses": () => Response.json(…) })`, and replace
`next/navigation` with `tests/support/next-navigation.ts` (inspect `router.push`, set the URL with `setLocation`).
