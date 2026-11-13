import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Three test projects:
 * - unit:       pure logic (validation, URL state, the API client, security helpers…). No database.
 * - components: React components rendered in jsdom with Testing Library. No database.
 * - api:        the Route Handlers called with real requests against PostgreSQL (TEST_DATABASE_URL,
 *               created and migrated by tests/support/global-setup.ts).
 *
 *   npm test               all three
 *   npm run test:unit      unit + components (seconds, nothing to start)
 *   npm run test:api       api only
 */
const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // `server-only` throws outside the React Server bundle; tests run server code directly.
  "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          // Some helpers read the server configuration; no connection is ever made.
          env: { DATABASE_URL: "postgres://unused@localhost:1/unused", AUTH_SECRET: "unit-test-secret-unit-test-secret-1234", MAIL_TRANSPORT: "memory" },
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/support/dom-setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          environment: "node",
          include: ["tests/api/**/*.test.{ts,tsx}"],
          globalSetup: ["tests/support/global-setup.ts"],
          setupFiles: ["tests/support/setup.ts"],
          // One database: these files run one after another.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
