import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration (Prisma 7: the connection URL lives here, not in schema.prisma).
 * Reads the same env files as Next.js (.env, .env.local, .env.development …), so DATABASE_URL is set once.
 * `process.env` rather than Prisma's env(): `prisma generate` must work without a database (Docker builds).
 */
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx scripts/db-seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
