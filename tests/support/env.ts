/** The test database. Created (if missing) and migrated before the tests run. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://lumina:lumina@localhost:5432/lumina_test";
