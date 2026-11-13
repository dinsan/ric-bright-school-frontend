import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { serverConfig } from "@/server/config";

/**
 * The database client: Prisma ORM 7 over node-postgres (the `@prisma/adapter-pg` driver adapter, so no
 * Rust query engine is involved). One client (and one pg pool) per server process, created on first use
 * so `next build` never connects. In development it is kept on globalThis, so hot reloads don't open a
 * new pool each time.
 *
 * The schema lives in prisma/schema.prisma; the client generated from it in src/generated/prisma
 * (`npm install` and `npm run db:client` regenerate it). See docs/backend.md, "Database".
 */

export type Database = PrismaClient;
/** The client or an open interactive transaction: helpers that take one can run inside `db.$transaction`. */
export type Executor = PrismaClient | Prisma.TransactionClient;

/** Row types (what `findUnique` / `findMany` return without `select`), named as the rest of the code uses them. */
export type {
  AuthToken as AuthTokenRow,
  Course as CourseRow,
  Lesson as LessonRow,
  OAuthAccount as OAuthAccountRow,
  Session as SessionRow,
  Subject as SubjectRow,
  TeacherProfile as TeacherProfileRow,
  User as UserRow,
} from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { luminaPrisma?: PrismaClient; luminaPrismaClass?: unknown };

function createClient(): PrismaClient {
  const config = serverConfig();
  const adapter = new PrismaPg(
    { connectionString: config.DATABASE_URL, max: config.DATABASE_POOL_MAX },
    // An idle client losing its connection (database restart) must not crash the server.
    { onPoolError: (error) => console.error("[db] idle client error", error) },
  );
  return new PrismaClient({ adapter });
}

export function getDb(): PrismaClient {
  // A regenerated client (`npm run db:client` while `next dev` runs) is a new class: switch to it, so
  // new models and fields work without restarting the dev server.
  if (!globalForDb.luminaPrisma || globalForDb.luminaPrismaClass !== PrismaClient) {
    void globalForDb.luminaPrisma?.$disconnect();
    globalForDb.luminaPrisma = createClient();
    globalForDb.luminaPrismaClass = PrismaClient;
  }
  return globalForDb.luminaPrisma;
}

/** Closes the connection pool (scripts and tests). */
export async function closeDb() {
  const client = globalForDb.luminaPrisma;
  globalForDb.luminaPrisma = undefined;
  globalForDb.luminaPrismaClass = undefined;
  await client?.$disconnect();
}

// --- Errors ------------------------------------------------------------------------------------------
//
// Prisma reports database errors as PrismaClientKnownRequestError with a Prisma code (P2002 unique
// constraint, P1001 unreachable, P2010 raw query failed …). With a driver adapter the driver's own error
// is kept in `meta.driverAdapterError.cause`: `{ kind, originalCode? , code? }`, where originalCode / code
// is the PostgreSQL SQLSTATE. The helpers below look there, and also at plain `code` / `cause` chains
// (node-postgres and Node network errors), so they work for any error that reaches a route.

type DriverErrorCause = { kind?: unknown; code?: unknown; originalCode?: unknown };

function driverErrorCause(error: unknown): DriverErrorCause | undefined {
  const meta = (error as { meta?: { driverAdapterError?: { cause?: DriverErrorCause } } } | null)?.meta;
  return meta?.driverAdapterError?.cause;
}

function isPrismaError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === "string" && name.startsWith("PrismaClient");
}

/** Driver adapter error kinds that mean "no usable connection". */
const UNAVAILABLE_KINDS = ["DatabaseNotReachable", "ConnectionClosed", "SocketTimeout", "TooManyConnections", "TlsConnectionError"];
/** Prisma codes for the same: unreachable, timed out, connection closed, pool timeout. */
const UNAVAILABLE_PRISMA_CODES = ["P1001", "P1002", "P1017", "P2024"];
const NETWORK_CODES = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH"];

/** PostgreSQL classes 08 (connection), 53 (resources), 57P (shutdown). */
function isUnavailableSqlState(code: string): boolean {
  return code.startsWith("08") || code.startsWith("53") || code.startsWith("57P");
}

/** True when an error means the database could not be reached (as opposed to a bad query). */
export function isDatabaseUnavailable(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth++) {
    if ((current as { name?: unknown }).name === "PrismaClientInitializationError") return true;

    const driver = driverErrorCause(current);
    if (driver) {
      if (typeof driver.kind === "string" && UNAVAILABLE_KINDS.includes(driver.kind)) return true;
      const sqlState = driver.originalCode ?? driver.code;
      if (typeof sqlState === "string" && isUnavailableSqlState(sqlState)) return true;
    }

    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") {
      if (isPrismaError(current)) {
        if (UNAVAILABLE_PRISMA_CODES.includes(code)) return true;
      } else {
        if (NETWORK_CODES.includes(code)) return true;
        if (isUnavailableSqlState(code)) return true;
      }
    }
    const message = current instanceof Error ? current.message : "";
    if (/Connection terminated|connect ECONNREFUSED|timeout exceeded when trying to connect|Can't reach database server/i.test(message)) return true;
    const nested = (current as { errors?: unknown[] }).errors;
    if (Array.isArray(nested) && nested.some((item) => isDatabaseUnavailable(item))) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** The PostgreSQL error code (SQLSTATE, e.g. "23505" unique violation) of an error or its cause. */
export function pgErrorCode(error: unknown): string | undefined {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth++) {
    const driver = driverErrorCause(current);
    const driverCode = driver?.originalCode ?? driver?.code;
    if (typeof driverCode === "string") return driverCode;
    // A Prisma error's own `code` is a Prisma code (P2002), not a SQLSTATE.
    if (isPrismaError(current)) {
      if ((current as { code?: unknown }).code === "P2002") return "23505";
    } else {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** True for a unique constraint violation (duplicate email, username, class code …). */
export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === "23505";
}

// --- Queries -----------------------------------------------------------------------------------------

/**
 * For Prisma's `contains` / `startsWith` filters (LIKE / ILIKE): Prisma passes the text through as a LIKE
 * pattern, so `%`, `_` and `\` typed in a search box would act as wildcards. Escaped, they are letters.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
