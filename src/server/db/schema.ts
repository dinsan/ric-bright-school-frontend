/**
 * The database schema (PostgreSQL, Drizzle ORM). Single source of truth for tables, constraints and
 * indexes: SQL migrations in /drizzle are generated from this file with `npm run db:generate`.
 *
 * Conventions: UUID primary keys (gen_random_uuid, built into PostgreSQL 13+), timestamptz everywhere,
 * emails and usernames stored lower-case, secrets only ever stored hashed or encrypted.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/** PostgreSQL full-text search vector (Drizzle has no built-in type for it). */
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/**
 * Weighted full-text search text, kept up to date by PostgreSQL (a generated column): title (A) counts
 * more than summary (B), which counts more than the description (C). Each text is indexed twice: with
 * English stemming ("fractions" also finds "fraction") and as written ("add" also finds "adding", which
 * English stems to "ad"). Column names are written literally: the expression is stored in the table.
 */
const searchVector = (columns: { a: string; b: string; c?: string }) => {
  const weighted = (column: string, weight: "A" | "B" | "C") =>
    `setweight(to_tsvector('english', coalesce(${column}, '')) || to_tsvector('simple', coalesce(${column}, '')), '${weight}')`;
  return tsvector("search_vector").generatedAlwaysAs(
    sql.raw([weighted(columns.a, "A"), weighted(columns.b, "B"), ...(columns.c ? [weighted(columns.c, "C")] : [])].join(" || ")),
  );
};

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

// --- Enums ------------------------------------------------------------------------------------------

export const userRole = pgEnum("user_role", ["student", "parent", "teacher", "admin"]);
export const courseStatus = pgEnum("course_status", ["draft", "published", "archived"]);
/** standard: normal sign-in (sliding expiry). classroom: picture sign-in on a shared device (one school day). impersonation: an admin viewing as the user. */
export const sessionKind = pgEnum("session_kind", ["standard", "classroom", "impersonation"]);
export const tokenPurpose = pgEnum("token_purpose", [
  "email_verification",
  "password_reset",
  "email_change",
  "mfa_challenge",
  "parent_link",
  "oauth_state",
]);

// --- Accounts ---------------------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRole("role").notNull(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    /** Lower-case. Students may have none. */
    email: varchar("email", { length: 254 }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /** Lower-case. Students sign in with it. */
    username: varchar("username", { length: 30 }),
    /** argon2id. Null for accounts that only use pictures or Google / Microsoft / Apple. */
    passwordHash: text("password_hash"),
    /** argon2id of the three picture keys in order (classroom sign-in). */
    pictureHash: text("picture_hash"),
    /** TOTP secret, encrypted with AUTH_SECRET (AES-256-GCM). */
    totpSecret: text("totp_secret"),
    /** Secret being set up, until the first code confirms it. Encrypted like totp_secret. */
    totpPendingSecret: text("totp_pending_secret"),
    /** Last accepted TOTP time step: a code can't be used twice. */
    totpLastStep: integer("totp_last_step"),
    mfaEnabledAt: timestamp("mfa_enabled_at", { withTimezone: true }),
    avatarUrl: text("avatar_url"),
    gradeLevel: smallint("grade_level"),
    language: varchar("language", { length: 10 }),
    timezone: varchar("timezone", { length: 64 }),
    /** Parents: the child the app is showing. */
    activeChildId: uuid("active_child_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    /** Who made this account (a parent adding a child). */
    createdById: uuid("created_by_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    isActive: boolean("is_active").default(true).notNull(),
    /** Failed sign-ins in a row, and the lock that follows too many. */
    failedSignIns: integer("failed_sign_ins").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_key").on(table.email),
    uniqueIndex("users_username_key").on(table.username),
    index("users_role_idx").on(table.role),
    index("users_created_at_idx").on(table.createdAt),
    check("users_email_lower", sql`${table.email} = lower(${table.email})`),
    check("users_username_lower", sql`${table.username} = lower(${table.username})`),
    check("users_grade_level_range", sql`${table.gradeLevel} between 1 and 12`),
  ],
);

export const teacherProfiles = pgTable("teacher_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  schoolName: varchar("school_name", { length: 120 }),
  /** Subject slugs. */
  subjects: text("subjects").array().default(sql`'{}'::text[]`).notNull(),
  gradeLevels: smallint("grade_levels").array().default(sql`'{}'::smallint[]`).notNull(),
  bio: varchar("bio", { length: 600 }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedById: uuid("verified_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** A parent or guardian and a child (student) account. */
export const guardianships = pgTable(
  "guardianships",
  {
    parentId: uuid("parent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** When the parent confirmed they are the parent or guardian and agreed for the child. */
    consentAt: timestamp("consent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.parentId, table.childId] }), index("guardianships_child_idx").on(table.childId)],
);

// --- Sign-in ----------------------------------------------------------------------------------------

/** Server-side sessions. The browser holds a random token; only its SHA-256 is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    kind: sessionKind("kind").default("standard").notNull(),
    /** The admin viewing as this user (kind = impersonation). */
    impersonatorId: uuid("impersonator_id").references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_key").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * One-time tokens sent by email or kept in a cookie: email verification, password reset, email change,
 * the MFA step after a password, a student's parent-link code, OAuth state. Only the SHA-256 is stored.
 */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purpose: tokenPurpose("purpose").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
    /** Wrong guesses against this token (the MFA step). */
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("auth_tokens_token_hash_key").on(table.tokenHash),
    index("auth_tokens_user_purpose_idx").on(table.userId, table.purpose),
    index("auth_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

/** MFA recovery codes, SHA-256 of the normalised code. Each works once. */
export const recoveryCodes = pgTable(
  "recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("recovery_codes_user_code_key").on(table.userId, table.codeHash)],
);

/** Google / Microsoft / Apple identities linked to an account. */
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull(),
    /** The provider's stable user id (`sub`). */
    subject: text("subject").notNull(),
    email: varchar("email", { length: 254 }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("oauth_accounts_provider_subject_key").on(table.provider, table.subject),
    uniqueIndex("oauth_accounts_user_provider_key").on(table.userId, table.provider),
  ],
);

// --- Schools ----------------------------------------------------------------------------------------

/** A teacher's class. Its code lets young students sign in with pictures on a classroom device. */
export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    /** Upper-case. */
    code: varchar("code", { length: 12 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("classes_code_key").on(table.code), index("classes_teacher_idx").on(table.teacherId)],
);

export const classMembers = pgTable(
  "class_members",
  {
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.classId, table.studentId] }), index("class_members_student_idx").on(table.studentId)],
);

// --- Catalog ----------------------------------------------------------------------------------------

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("subjects_slug_key").on(table.slug)],
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 120 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    summary: varchar("summary", { length: 400 }).notNull(),
    description: text("description"),
    gradeLevel: smallint("grade_level").notNull(),
    status: courseStatus("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    searchVector: searchVector({ a: "title", b: "summary", c: "description" }),
  },
  (table) => [
    uniqueIndex("courses_slug_key").on(table.slug),
    index("courses_status_grade_idx").on(table.status, table.gradeLevel),
    index("courses_subject_idx").on(table.subjectId),
    index("courses_search_idx").using("gin", table.searchVector),
    // Typo-tolerant matching on titles (pg_trgm, enabled by migration 0001).
    index("courses_title_trgm_idx").using("gin", table.title.op("gin_trgm_ops")),
    check("courses_grade_level_range", sql`${table.gradeLevel} between 1 and 12`),
  ],
);

/**
 * The lessons of a course, in order. For now a lesson is its title, summary and length (the course
 * outline, and what search finds); the lesson content itself comes with the lesson player (FE-STU-03).
 * A lesson is public when its course is published.
 */
export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Unique within its course; also the anchor on the course page (#lesson-{slug}). */
    slug: varchar("slug", { length: 120 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    summary: varchar("summary", { length: 400 }).notNull(),
    /** 1, 2, 3… within the course. */
    position: smallint("position").notNull(),
    durationMinutes: smallint("duration_minutes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    searchVector: searchVector({ a: "title", b: "summary" }),
  },
  (table) => [
    uniqueIndex("lessons_course_slug_key").on(table.courseId, table.slug),
    index("lessons_course_position_idx").on(table.courseId, table.position),
    index("lessons_search_idx").using("gin", table.searchVector),
    index("lessons_title_trgm_idx").using("gin", table.title.op("gin_trgm_ops")),
    check("lessons_position_positive", sql`${table.position} > 0`),
    check("lessons_duration_range", sql`${table.durationMinutes} between 1 and 240`),
  ],
);

// --- Operations -------------------------------------------------------------------------------------

/** Who did what to whom: admin actions and impersonation. Kept when either account is deleted. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: createdAt(),
  },
  (table) => [index("audit_events_created_at_idx").on(table.createdAt), index("audit_events_target_idx").on(table.targetUserId)],
);

/** Fixed-window request counters (sign-in attempts, class code lookups, emails sent). */
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 200 }).primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type SubjectRow = typeof subjects.$inferSelect;
export type LessonRow = typeof lessons.$inferSelect;
