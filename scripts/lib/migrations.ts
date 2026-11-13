/**
 * Shared by `npm run db:migrate` (scripts/db-migrate.ts) and the API test setup: runs the Prisma CLI, and
 * adopts databases created before the move to Prisma (when the schema was managed with Drizzle).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { Client } from "pg";

/** The first Prisma migration: the whole schema as the last Drizzle migration left it. */
export const BASELINE_MIGRATION = "20261112000000_init";

/**
 * `created_at` of the last Drizzle migration (0002_search_and_lessons) in drizzle.__drizzle_migrations.
 * A database that has it matches BASELINE_MIGRATION exactly (checked with `prisma migrate diff`).
 */
const LAST_DRIZZLE_MIGRATION = 1794509487878;

/**
 * Runs the project's Prisma CLI (node_modules/prisma) against `databaseUrl`. Throws when it fails.
 * `quiet`: the CLI output is only shown when it fails (tests).
 */
export function runPrisma(args: string[], databaseUrl: string, { quiet = false } = {}) {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const cli = require.resolve("prisma/build/index.js");
  const result = spawnSync(process.execPath, [cli, ...args], {
    stdio: quiet ? "pipe" : "inherit",
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (quiet) process.stderr.write(`${result.stdout ?? ""}${result.stderr ?? ""}`);
    throw new Error(`prisma ${args.join(" ")} failed (exit code ${result.status})`);
  }
}

export interface DatabaseState {
  /** _prisma_migrations exists: Prisma manages this database. */
  prisma: boolean;
  /** drizzle.__drizzle_migrations exists: created by the Drizzle version of the app. */
  drizzle: boolean;
  /** Tables in the public schema (other than _prisma_migrations). */
  tables: number;
}

export async function databaseState(databaseUrl: string): Promise<DatabaseState> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ prisma: boolean; drizzle: boolean; tables: number }>(`
      select to_regclass('public._prisma_migrations') is not null as prisma,
             to_regclass('drizzle.__drizzle_migrations') is not null as drizzle,
             (select count(*)::int from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations') as tables`);
    return rows[0]!;
  } finally {
    await client.end();
  }
}

/**
 * A database made by the Drizzle version of the app has the same tables, but no Prisma history, and
 * `prisma migrate deploy` refuses a non-empty database (P3005). When all the Drizzle migrations were
 * applied, the schema is exactly the baseline: it is marked as applied (`prisma migrate resolve`) and the
 * Drizzle bookkeeping schema is dropped. Data is untouched. Returns true when it adopted the database.
 */
export async function adoptDrizzleDatabase(databaseUrl: string, log: (message: string) => void = console.log): Promise<boolean> {
  const state = await databaseState(databaseUrl);
  if (state.prisma || !state.drizzle) return false;

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ last: string | null }>("select max(created_at)::text as last from drizzle.__drizzle_migrations");
    if (Number(rows[0]?.last ?? 0) !== LAST_DRIZZLE_MIGRATION) {
      throw new Error(
        "This database was created by an older version of Lumina (Drizzle migrations) and is missing some of them, " +
          "so it can't be moved to Prisma automatically. For a development database, start from an empty one " +
          "(Docker: `docker compose down -v`), then run `npm run db:migrate` and `npm run db:seed` again.",
      );
    }
    log(`[db] database created with Drizzle: marking ${BASELINE_MIGRATION} as applied (no changes to tables or data)`);
    runPrisma(["migrate", "resolve", "--applied", BASELINE_MIGRATION], databaseUrl);
    await client.query("drop schema drizzle cascade");
    return true;
  } finally {
    await client.end();
  }
}
