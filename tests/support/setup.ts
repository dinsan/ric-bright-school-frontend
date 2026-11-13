import { afterAll, beforeEach } from "vitest";
import { TEST_DATABASE_URL } from "./env";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.MAIL_TRANSPORT = "memory";
process.env.APP_URL = "http://lumina.test";
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
delete process.env.COOKIE_SECURE;
for (const key of Object.keys(process.env)) if (/^(GOOGLE|MICROSOFT|APPLE)_/.test(key)) delete process.env[key];

const { getDb, closeDb } = await import("@/server/db");
const { outbox } = await import("@/server/mail");

/** Every test starts from an empty database and an empty outbox. */
beforeEach(async () => {
  const rows = await getDb().$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  if (rows.length) await getDb().$executeRawUnsafe(`truncate ${rows.map((row) => `"${row.tablename}"`).join(", ")} cascade`);
  outbox.length = 0;
});

afterAll(async () => {
  await closeDb();
});
