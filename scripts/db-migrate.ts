/**
 * Applies the migrations in prisma/migrations to DATABASE_URL (`prisma migrate deploy`). Safe to run
 * repeatedly: applied migrations are recorded in _prisma_migrations and skipped. Used by the Docker
 * entrypoints and the migrator image.
 *
 *   npm run db:migrate
 *
 * A database created by the Drizzle version of the app is adopted first (see scripts/lib/migrations.ts).
 * To create a new migration after changing prisma/schema.prisma, use `npm run db:generate -- --name …`.
 */
import { loadEnvConfig } from "@next/env";
import { adoptDrizzleDatabase, runPrisma } from "./lib/migrations";

loadEnvConfig(process.cwd());

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required, for example postgres://lumina:lumina@localhost:5432/lumina");
  const started = Date.now();
  await adoptDrizzleDatabase(databaseUrl);
  runPrisma(["migrate", "deploy"], databaseUrl);
  console.log(`[db] migrations applied in ${Date.now() - started} ms`);
}

main().catch((error) => {
  console.error("[db] migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
