# Moving from Drizzle to Prisma: migration notes

Lumina's database layer moved from Drizzle ORM to **Prisma ORM 7**. This document records what changed, why the
result is equivalent, how it was verified, and what is left to do. For day-to-day work with the database, read
"Database" in [`backend.md`](backend.md) instead.

## Summary

- Drizzle is gone: `drizzle-orm`, `drizzle-kit`, `drizzle.config.ts`, the `drizzle/` migrations and
  `src/server/db/schema.ts` were removed. Nothing imports Drizzle any more.
- The schema is `prisma/schema.prisma`. It describes the **same database** as before: same tables, columns, types,
  defaults, enums, foreign keys (with the same `ON DELETE` rules), indexes and constraint names.
- One baseline migration, `prisma/migrations/20261112000000_init`, creates that database from scratch.
- Every query goes through the generated Prisma Client (`getDb()` from `src/server/db`), over node-postgres with
  the `@prisma/adapter-pg` driver adapter. A few queries are raw SQL on purpose (search, lockout counters, rate
  limits); see below.
- Existing databases (development volumes, any deployed database) are **adopted without changes** by
  `npm run db:migrate`.
- The HTTP API, the pages and the database contents are unchanged. No API response, cookie or URL changed.

Versions: `prisma` 7.10.1 (CLI, dev dependency), `@prisma/client` 7.10.0, `@prisma/adapter-pg` 7.10.1, `pg` 8.

## Files

| Added | What |
| --- | --- |
| `prisma/schema.prisma` | Generator (`prisma-client`, output `src/generated/prisma`), datasource, 4 enums, 15 models |
| `prisma/migrations/20261112000000_init/migration.sql` | Baseline: the whole schema, plus the hand-written parts (below) |
| `prisma/migrations/migration_lock.toml` | Provider lock (PostgreSQL), managed by Prisma |
| `prisma.config.ts` | Prisma 7 CLI config: schema and migrations paths, seed command, `DATABASE_URL` (loaded with `@next/env`, so `.env.local` etc. work as they do for Next.js) |
| `scripts/lib/migrations.ts` | Runs the Prisma CLI from scripts and tests; adopts Drizzle-era databases |
| `docs/prisma-migration.md` | This document |

| Changed | How |
| --- | --- |
| `src/server/db/index.ts` | `getDb()` returns a `PrismaClient` (lazy, one per process, kept on `globalThis` and replaced when the client is regenerated during `next dev`), `closeDb()`, `Executor` (client or transaction), row types (`UserRow`, `SessionRow`, …), `isDatabaseUnavailable`, `pgErrorCode`, new `isUniqueViolation` and `escapeLike` |
| `src/server/**` services | Every Drizzle query rewritten (see "Query by query" below) |
| `src/app/api/health/route.ts` | `select 1` through `$queryRaw` |
| `scripts/db-migrate.ts` | Adopts a Drizzle-era database if needed, then `prisma migrate deploy` |
| `scripts/db-seed.ts` | Prisma Client; still idempotent (`createMany` with `skipDuplicates`, find-or-create users) |
| `tests/support/global-setup.ts`, `setup.ts`, `factories.ts`, `tests/api/*` | Prisma migrations and Prisma Client; the per-test truncate skips `_prisma_migrations` |
| `tests/unit/server-http.test.ts` | Error helpers tested with real Prisma error shapes; `escapeLike` |
| `tests/api/admin.test.ts` | New check: `%` and `_` typed in the admin user search are literal |
| `package.json` | Dependencies; scripts `postinstall`, `db:client`, `db:generate`, `db:check`, `db:studio` (see below) |
| `Dockerfile` | OpenSSL for the Prisma CLI on Alpine; schema copied before `npm ci` (its `postinstall` generates the client); generated client copied into the build stage |
| `scripts/docker/dev-entrypoint.sh` | Generates the client on start (the mounted checkout hides the image's copy) |
| `Makefile`, `compose.yaml` | `make db-generate NAME=…` (also regenerates the client), `make db-check`, Prisma wording |
| `.gitignore`, `.dockerignore`, `eslint.config.mjs` | `src/generated/` is generated: not committed, not copied into images, not linted |
| `README.md`, `docs/backend.md`, `TODO.md` | Stack, commands, troubleshooting, the "Database" guide, new tasks |

## npm scripts

| Script | Command | Note |
| --- | --- | --- |
| `postinstall` | `prisma generate` | `npm ci` / `npm install` produce `src/generated/prisma` |
| `db:client` | `prisma generate` | After changing `schema.prisma` (Prisma 7's `migrate dev` no longer generates) |
| `db:generate` | `prisma migrate dev --create-only` | Writes the next migration for review; pass `-- --name add_x`. Needs `CREATEDB` (shadow database) |
| `db:migrate` | `tsx scripts/db-migrate.ts` | Adoption of Drizzle-era databases, then `prisma migrate deploy`. Used by Docker (dev entrypoint and the `migrator` image) |
| `db:check` | `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | 0 when the database matches the schema, 2 when a migration is missing |
| `db:seed` | `tsx scripts/db-seed.ts` | Unchanged behaviour |
| `db:studio` | `prisma studio` | Replaces Drizzle Studio |

## The schema, and what Prisma can't express

`schema.prisma` was written to match the Drizzle schema exactly, then checked against a database built by the old
Drizzle migrations (see "Verification"). Points worth knowing:

- **Names.** Models are PascalCase with camelCase fields, mapped to the existing snake_case tables and columns with
  `@map` / `@@map`. Every primary key, unique constraint, index and foreign key has an explicit `map:` name equal to
  the Drizzle-era name (for example `users_email_key`, `sessions_user_id_users_id_fk`), so the diff against existing
  databases is empty and future Prisma versions can't rename them.
- **Relations** use `onUpdate: NoAction` (Drizzle's default, and what the databases have) and the same `onDelete`
  as before. Self-relations on `users` (`ActiveChild`, `CreatedBy`) and the two user relations of `guardianships`,
  `sessions`, `teacher_profiles` and `audit_events` are named.
- **`updated_at`** uses `@updatedAt` (Prisma sets it on every update through the client, like Drizzle's
  `$onUpdate`) plus `@default(now())`.
- **Written by hand in the baseline migration** (marked "Not in schema.prisma" in the SQL). Prisma's diff ignores
  all of these, so they never appear as drift and new migrations never touch them:
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm` (trigram indexes for typo-tolerant search);
  - the `CHECK` constraints: lower-case emails and usernames, grade 1–12 on users and courses, lesson position > 0,
    lesson duration 1–240;
  - `courses.search_vector` and `lessons.search_vector` as `GENERATED ALWAYS AS (…) STORED` columns. The schema
    declares them `Unsupported("tsvector")?` with the generation expression, exactly as PostgreSQL prints it, in
    `@default(dbgenerated("…"))`: that is how Prisma recognises a generated column, so it neither drops it nor tries
    to set a default. Prisma Client can't read or write `Unsupported` fields, which is what we want (search reads
    them with raw SQL);
  - `NOT NULL` on `teacher_profiles.subjects` and `grade_levels` (Prisma lists can't be marked required); both
    default to an empty array.
  - The GIN indexes (`type: Gin`, and `ops: raw("gin_trgm_ops")` for the trigram ones) are in the schema.

## Query by query

The translation kept every rule and every atomic operation. The patterns:

| Drizzle | Prisma |
| --- | --- |
| `db.select().from(t).where(eq(…)).limit(1)` | `findUnique` (unique keys) or `findFirst` |
| joins (`innerJoin`, `leftJoin`) | `include` / `select` of relations, relation filters (`student: { isActive: true }`), ordering by relation fields |
| `insert(…).returning()` | `create`; several rows `createMany` / `createManyAndReturn` |
| `onConflictDoNothing()` | `createMany({ data, skipDuplicates: true })` (same SQL: `ON CONFLICT DO NOTHING`) |
| `onConflictDoUpdate` on a unique key | `upsert` with that key in `where` and `create` (Prisma runs it as a native `INSERT … ON CONFLICT DO UPDATE`) |
| conditional `update(…).where(…).returning()` | `updateMany` (count) / `updateManyAndReturn` (rows): one `UPDATE … WHERE …` statement, so racing requests still can't both consume a token or reuse a TOTP step |
| `delete(…).returning({ id })` to know if something was deleted | `deleteMany` and its `count` |
| `db.transaction(async (tx) => …)` | `$transaction(async (tx) => …)`; independent writes as `$transaction([…])` |
| `count()` / `groupBy` | `count`, `groupBy` with `_count` / `_min` / `_max` |
| `ilike(col, '%' + escaped + '%')` | `{ contains: escapeLike(q), mode: "insensitive" }` (Prisma does **not** escape `%` and `_` itself; checked) |
| `sql\`…\`` fragments | raw SQL with `$queryRaw` / `Prisma.sql` / `Prisma.join` (bound parameters only) |

Raw SQL is used where Prisma has no equivalent:

- `src/server/search/service.ts`: `to_tsquery`, `ts_rank_cd`, `setweight`, `word_similarity`. Same SQL as before,
  same ordering and limits; results mapped from snake_case row types.
- `src/server/http/rate-limit.ts`: one `INSERT … ON CONFLICT DO UPDATE … RETURNING` whose new values depend on the
  stored window (atomic across server instances).
- `src/server/auth/sign-in.ts` (`recordFailedSignIn`) and `src/server/auth/tokens.ts` (`recordTokenAttempt`):
  `UPDATE … SET n = n + 1, locked_until = CASE … END RETURNING`, atomic.

Small, deliberate differences:

- **Times written by the app.** Where Drizzle wrote `now()` (the database clock), Prisma Client writes `new Date()`
  (the server clock): `used_at` of tokens and recovery codes, `last_login_at`, `email_verified_at`, `consent_at`,
  `verified_at`, `mfa_enabled_at`, and the "not expired" comparisons of sessions and tokens. Server and database
  clocks are NTP-synchronised in any normal deployment, so this has no visible effect. The raw SQL above still uses
  `now()`.
- **`email_verified_at` is kept, not overwritten** (Drizzle: `coalesce(email_verified_at, now())` in SQL; now
  `user.emailVerifiedAt ?? new Date()` from the row just read). Same result.
- **Sign-up** (and OAuth sign-up) create the user, the teacher profile and the linked identity with one nested
  `create`, which Prisma runs in a transaction, instead of an explicit transaction.
- **Error handling.** Prisma wraps database errors (`PrismaClientKnownRequestError`, code `P2002`, `P1001`,
  `P2010` …) and keeps the driver's error in `error.meta.driverAdapterError.cause` (`kind`, `originalCode`). The
  helpers read that: a unique violation is recognised for both client calls (P2002) and raw SQL (P2010 with SQLSTATE
  23505); an unreachable database (`DatabaseNotReachable`, closed connections, SQLSTATE classes 08/53/57P, P1001,
  P1002, P1017, P2024, initialisation errors) still answers 503. Services call `isUniqueViolation(error)` instead of
  comparing `pgErrorCode(error)` with `"23505"`.

## Existing databases (adoption)

A database created by the Drizzle migrations has the right tables but no `_prisma_migrations`, and
`prisma migrate deploy` refuses a non-empty database without history (P3005). `npm run db:migrate` therefore
first runs `adoptDrizzleDatabase` (`scripts/lib/migrations.ts`):

1. If `drizzle.__drizzle_migrations` exists and `_prisma_migrations` doesn't, check that the last Drizzle migration
   (`0002_search_and_lessons`, `created_at` 1794509487878) was applied. If not, stop with a message (a development
   database: recreate it).
2. `prisma migrate resolve --applied 20261112000000_init`: record the baseline as applied without running it.
3. `DROP SCHEMA drizzle CASCADE`: only Drizzle's bookkeeping table lives there.

Then `prisma migrate deploy` runs as usual. Tables and data are not touched. It runs once per database; afterwards
the check in step 1 is false and nothing happens. For production, the same happens in the `migrator` image: take a
backup first anyway (standard practice for any deploy with migrations).

The API tests' own database (`lumina_test`) is simply dropped and recreated when it is found in the Drizzle state.

## Verification

All of this was run after the change:

| Check | Result |
| --- | --- |
| `npm run typecheck`, `npm run lint` | Clean (generated client excluded from lint) |
| `npm test` | 22 files, **197 tests passed** (194 before the move, plus new error-helper, `escapeLike` and admin-search tests) |
| Schema equivalence | `prisma migrate deploy` on an empty database, then `pg_dump --schema-only` compared with a database built by the three Drizzle migrations: identical apart from how PostgreSQL spells equivalent defaults. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`: empty for both databases |
| New migrations stay clean | A test field added to `schema.prisma` produced a migration with only that `ADD COLUMN` (nothing about search vectors, CHECK constraints or the extension); removed afterwards |
| Adoption | The development database (Drizzle-built, with data): `npm run db:migrate` adopted it, the data-only `pg_dump` before and after is identical, `npm run db:check` reports no difference, a second run does nothing. A database with a missing Drizzle migration is refused with the message. A Drizzle-built `lumina_test` is recreated by the tests |
| Seed | On an empty database and twice in a row on the development database: same rows, no duplicates |
| `npm ci` from scratch | `postinstall` generates the client; no Drizzle package in the lockfile |
| `next build` + standalone server | Builds; the standalone output contains `@prisma/client` (query compiler as WebAssembly), the adapter and `pg`; no engine binary needed |
| In Chromium against the standalone server | Account flows (sign-up with email link, child with picture sign-in, class code sign-in, teacher MFA set-up and sign-in, admin impersonation), public pages with axe (desktop and 360 px), search (keyboard, typo tolerance, `/search` without JavaScript, signed-in search): all pass. One axe finding in the search dialog at 360 px is unrelated to the database (FE-PUB-13 in `TODO.md`) |
| Database down | `/api/health`, `/api/courses`, `/api/search` and `/api/session` (with a session cookie) answer 503 `service_unavailable`; nobody is signed out |
| `next dev` | Pages and API work; regenerating the client while it runs is picked up without a restart |

### Limits of that verification

The environment the move was made in could reach the npm registry but **not** `binaries.prisma.sh`, where the
Prisma CLI downloads its native schema engine (needed by `migrate`, `db pull`, `studio`; not by the app at
runtime, and not by `prisma generate`). The CLI was therefore run with a stand-in for the schema engine, outside
the repository, built on Prisma's own WebAssembly schema engine (`@prisma/schema-engine-wasm`) and
`@prisma/adapter-pg`, via `PRISMA_SCHEMA_ENGINE_BINARY`. It implements the same protocol, and the results above
(migration SQL, diffs, `migrate deploy`, `migrate resolve`, `migrate dev`) came from it. The real engine is the same
code compiled natively, so no difference is expected, but it has not been run here, and neither has Docker. Both are
listed in "Still to do". (One quirk of the stand-in, not of Prisma: it split SQL scripts on `;`, so the baseline's
SQL comments contain no semicolons.)

## Still to do

Also in `TODO.md`:

- **BE-APP-14 (P0)**: run the Prisma CLI with its real engine on a normal machine and in Docker: `npm ci`,
  `npm run db:migrate` (empty database, and a copy of a Drizzle-era database), `npm run db:generate -- --name x`,
  `npm run db:check`, `npm run db:studio`; `docker compose up` on a fresh clone and on an existing volume; the
  `migrate` job of `compose.prod.yaml`. Together with FE-FIX-02.
- **BE-APP-15 (P1)**: CI checks for the schema: `prisma validate`, `prisma format --check`, and `npm run db:check`
  after migrating an empty database.
- **BE-APP-16 (P2)**: remove the Drizzle adoption code once no database anywhere still has a `drizzle` schema.
- **BE-APP-17 (P2)**: consider TypedSQL for the search queries (typed results; needs a database at generate time).
- Deploys: the first deploy with this version adopts the production database in the `migrator` step. Take a backup
  before it, as for any migration, and check the `migrate` job's log says "marking 20261112000000_init as applied".
- Keep in mind when changing the schema: the hand-written parts above are not regenerated. For example, a new
  searchable column needs the `search_vector` expression changed in a migration **and** in `schema.prisma`.
