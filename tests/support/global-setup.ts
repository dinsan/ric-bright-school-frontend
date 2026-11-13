import { Client } from "pg";
import { databaseState, runPrisma } from "../../scripts/lib/migrations";
import { TEST_DATABASE_URL } from "./env";

/**
 * Creates the test database if needed and applies the Prisma migrations (`prisma migrate deploy`), once
 * per test run. A test database that Prisma doesn't manage yet (made by the Drizzle version of the app)
 * is recreated: it only ever holds test data.
 */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/i.test(name) || !name.includes("test")) {
    throw new Error(`TEST_DATABASE_URL must name a test database (with "test" in its name), got "${name}"`);
  }
  const admin = new Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
  await admin.connect();
  try {
    const exists = await admin.query("select 1 from pg_database where datname = $1", [name]);
    if (exists.rowCount === 0) {
      await admin.query(`create database "${name}"`);
    } else {
      const state = await databaseState(TEST_DATABASE_URL);
      if (!state.prisma && (state.tables > 0 || state.drizzle)) {
        await admin.query(`drop database "${name}" with (force)`);
        await admin.query(`create database "${name}"`);
      }
    }
  } finally {
    await admin.end();
  }
  runPrisma(["migrate", "deploy"], TEST_DATABASE_URL, { quiet: true });
}
