/**
 * The accounts API contract: the JSON shapes and paths shared by the browser (feature `api.ts` files)
 * and this app's own API (Route Handlers in src/app/api, services in src/server). Both sides import
 * these types, so a change here is checked on both ends by the compiler.
 *
 * Paths are relative to /api (the browser calls `/api${path}`). The server implementation and the
 * database behind it are described in docs/backend.md; sessions and sign-in in docs/auth.md.
 *
 * This module must stay free of server-only and client-only code: both bundles import it.
 */

export type Role = "student" | "parent" | "teacher" | "admin";
export const ROLES: readonly Role[] = ["student", "parent", "teacher", "admin"];

// --- Shared rules (validated in the browser for feedback, and again on the server) ----------------------

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/** Usernames: lower-case letters and digits, dots, dashes and underscores, 3 to 30 characters. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;
/** Languages the interface can be shown in once translations exist (FE-I18N). */
export const LANGUAGES = [
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["pt", "Português"],
] as const;
export type LanguageCode = (typeof LANGUAGES)[number][0];

// --- Sign-in results ---------------------------------------------------------------------------------

/**
 * What every sign-in endpoint answers. The session itself is an httpOnly cookie set by the server;
 * it never appears in a response body.
 */
export type SignInResult = { signed_in: true; user: Me } | { mfa_required: true };

/** GET /api/session: who is signed in. */
export interface SessionPayload {
  user: Me | null;
  /** An admin is viewing the app as this user (support impersonation). */
  impersonating: boolean;
}

// --- Accounts -------------------------------------------------------------------------------------

/** GET /me. */
export interface Me {
  id: string;
  role: Role;
  display_name: string;
  email: string | null; // students may have none
  username: string | null; // students sign in with one
  email_verified: boolean;
  mfa_enabled: boolean;
  avatar_url?: string | null;
  /** Students: drives the age-appropriate presentation (grade band). */
  grade_level?: number | null;
  language?: string | null;
  timezone?: string | null;
  teacher_profile?: TeacherProfile | null;
  /** Parents: the child the parent is currently looking at. */
  active_child_id?: string | null;
  created_at?: string;
}

export interface TeacherProfile {
  school_name: string | null;
  /** Subject slugs. */
  subjects: string[];
  grade_levels: number[];
  bio: string | null;
  /** Set by an admin (PUT /admin/users/{id}/teacher-verification). */
  verified: boolean;
}

/** PATCH /me. */
export interface MeUpdate {
  display_name?: string;
  language?: string;
  timezone?: string;
}

export interface Session {
  id: string;
  current: boolean;
  /** The browser's user agent; the UI turns it into "Chrome on Windows". */
  device: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export interface LinkedAccount {
  provider: OAuthProvider;
  email: string | null;
  linked_at: string;
}

export type OAuthProvider = "google" | "microsoft" | "apple";
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ["google", "microsoft", "apple"];

/** GET /auth/oauth/providers: the providers this server has credentials for. */
export interface OAuthProviders {
  providers: OAuthProvider[];
}

/** POST /me/mfa/totp. */
export interface TotpSetup {
  secret: string;
  /** otpauth://totp/... for the QR code. */
  otpauth_uri: string;
}

export interface RecoveryCodes {
  recovery_codes: string[];
}

// --- Families -------------------------------------------------------------------------------------

export type ChildSignInMethod = "password" | "pictures";

export interface Child {
  id: string;
  display_name: string;
  grade_level: number | null;
  username: string | null;
  /** How the child signs in; null until a parent sets it up. */
  sign_in_method: ChildSignInMethod | null;
}

/** POST /me/children. Adding a child is also the parent's consent (FE-AUTH-07). */
export interface ChildCreate {
  display_name: string;
  grade_level: number;
  /** Parent or guardian confirms they may create the account and agree to the terms. */
  parental_consent: true;
}

/** PUT /me/children/{child_id}/sign-in. */
export type ChildSignInSetup =
  | { method: "password"; username: string; password: string }
  | { method: "pictures"; username: string; pictures: [PictureKey, PictureKey, PictureKey] };

/** POST /me/link-code (a student creates it for a parent). */
export interface LinkCode {
  code: string;
  expires_at: string;
}

/**
 * GET /me/children/{child_id}/data: a copy of everything Lumina stores about the child, for the
 * parent to keep (FE-PUB-11). Grows as features add data about children (learning progress, BE-APP-10).
 */
export interface ChildDataExport {
  exported_at: string;
  child: {
    id: string;
    display_name: string;
    grade_level: number | null;
    username: string | null;
    sign_in_method: ChildSignInMethod | null;
    language: string | null;
    timezone: string | null;
    created_at: string;
    last_login_at: string | null;
  };
  /** The parents and guardians connected to the account. */
  guardians: Array<{ display_name: string; linked_at: string; consent_at: string | null }>;
  /** The school classes the child is in. */
  classes: Array<{ name: string; joined_at: string }>;
  /** Their learning (Phase 5): courses taken, lessons opened or finished, and learning time per day. */
  learning: {
    courses: Array<{ course: string; enrolled_at: string; completed_at: string | null }>;
    lessons: Array<{
      course: string;
      lesson: string;
      status: "started" | "completed";
      seconds_spent: number;
      started_at: string;
      completed_at: string | null;
      /** Where each video was left, in seconds. */
      video_positions: Record<string, number>;
    }>;
    days: Array<{ day: string; seconds_spent: number; lessons_completed: number }>;
    badges: Array<{ badge: string; earned_at: string }>;
    /** Notes the child wrote in lessons, and their bookmarks (FE-STU-06). */
    notes: Array<{ course: string; lesson: string; about: string | null; text: string; written_at: string; changed_at: string }>;
    bookmarks: Array<{ course: string; lesson: string; about: string | null; video_seconds: number | null; created_at: string }>;
    /** Quick-check questions scheduled for review: how well known, and when they come back. */
    review: Array<{ course: string; lesson: string; question: string; box: number; reviews: number; misses: number; due_at: string }>;
    certificates: Array<{ code: string; course: string; student_name: string; issued_at: string }>;
  };
  /** What the copy covers, in plain words. */
  notes: string;
}

// --- Classroom sign-in (class code + 3 pictures) -----------------------------------------------------

/**
 * GET  /auth/class/{class_code}  -> ClassRoster (who is in the class, and the picture set)
 * POST /auth/login/pictures      -> SignInResult, body PictureSignIn
 * Pictures are identified by key; the images live in the app (features/auth/pictures.tsx).
 */
export const PICTURE_KEYS = ["cat", "dog", "star", "sun", "moon", "tree", "fish", "apple", "rocket", "flower", "bird", "car"] as const;
export type PictureKey = string;
export const PICTURE_COUNT = 3;

export interface ClassRoster {
  class_name: string;
  students: Array<{ id: string; display_name: string; avatar_url?: string | null }>;
  /** The pictures to show, in display order. */
  pictures?: PictureKey[];
}

export interface PictureSignIn {
  class_code: string;
  student_id: string;
  /** The three pictures, in the order tapped. Order matters. */
  pictures: [PictureKey, PictureKey, PictureKey];
}

// --- Admin ------------------------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  role: Role;
  display_name: string;
  email: string | null;
  username: string | null;
  is_active: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  teacher_verified: boolean | null;
  created_at: string;
  last_login_at: string | null;
}

/** GET /admin/users uses the same page envelope as the catalog. Query: q, role, limit, offset. */
export interface UserPage {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

// --- Request bodies ---------------------------------------------------------------------------------

export interface RegisterRequest {
  role: "parent" | "teacher";
  display_name: string;
  email: string;
  password: string;
  accept_terms: true;
}
export interface EmailPasswordLogin {
  email: string;
  password: string;
}
export interface UsernameLogin {
  username: string;
  password: string;
}
/** `code` is a 6-digit authenticator code or a recovery code. The MFA step itself is an httpOnly cookie. */
export interface MfaLogin {
  code: string;
}
export interface TokenRequest {
  token: string;
}
export interface EmailRequest {
  email: string;
}
export interface PasswordReset {
  token: string;
  password: string;
}
export interface PasswordChange {
  current_password: string;
  new_password: string;
}
export interface EmailChange {
  new_email: string;
  password: string;
}
/** DELETE /me: password re-entry for accounts that have one. */
export interface AccountDeletion {
  password?: string;
}
export interface TotpCode {
  code: string;
}
export type TeacherProfileUpdate = Partial<Omit<TeacherProfile, "verified">>;
export interface LinkChildRequest {
  code: string;
}
export interface ActiveChildRequest {
  child_id: string;
}
export interface AdminUserUpdate {
  role?: Role;
  is_active?: boolean;
}
export interface TeacherVerification {
  verified: boolean;
}

/**
 * OAuth: the browser goes to /api/auth/oauth/{provider}/start (with `next`, and `intent=link` from the
 * account page or `intent=signup&role=…` from the sign-up page). The server redirects to the provider,
 * which sends the browser back to /auth/callback; that route signs in, signs up or links the account.
 */
export const OAUTH_CALLBACK_PATH = "/auth/callback";
export type OAuthIntent = "signin" | "signup" | "link";

// --- Paths ------------------------------------------------------------------------------------------

const id = (value: string) => encodeURIComponent(value);

export const paths = {
  currentSession: "/session",
  logout: "/auth/logout",
  register: "/auth/register",
  verifyEmail: "/auth/verify-email",
  resendVerification: "/auth/verify-email/resend",
  login: "/auth/login",
  loginUsername: "/auth/login/username",
  loginMfa: "/auth/login/mfa",
  loginPictures: "/auth/login/pictures",
  classRoster: (classCode: string) => `/auth/class/${id(classCode)}`,
  oauthProviders: "/auth/oauth/providers",
  oauthStart: (provider: OAuthProvider) => `/auth/oauth/${id(provider)}/start`,
  passwordForgot: "/auth/password/forgot",
  passwordReset: "/auth/password/reset",
  emailConfirm: "/auth/email/confirm",

  me: "/me",
  mePassword: "/me/password",
  meEmail: "/me/email",
  sessions: "/me/sessions",
  session: (sessionId: string) => `/me/sessions/${id(sessionId)}`,
  revokeOtherSessions: "/me/sessions/revoke-others",
  linkedAccounts: "/me/oauth",
  unlinkAccount: (provider: OAuthProvider) => `/me/oauth/${id(provider)}`,
  totp: "/me/mfa/totp",
  totpConfirm: "/me/mfa/totp/confirm",
  recoveryCodes: "/me/mfa/recovery-codes",
  teacherProfile: "/me/teacher-profile",
  children: "/me/children",
  child: (childId: string) => `/me/children/${id(childId)}`,
  childData: (childId: string) => `/me/children/${id(childId)}/data`,
  childSignIn: (childId: string) => `/me/children/${id(childId)}/sign-in`,
  linkChild: "/me/children/link",
  activeChild: "/me/active-child",
  linkCode: "/me/link-code",

  adminUsers: "/admin/users",
  adminCourses: "/admin/courses",
  adminCourse: (courseId: string) => `/admin/courses/${id(courseId)}`,
  adminUser: (userId: string) => `/admin/users/${id(userId)}`,
  adminTeacherVerification: (userId: string) => `/admin/users/${id(userId)}/teacher-verification`,
  adminMfa: (userId: string) => `/admin/users/${id(userId)}/mfa`,
  adminImpersonate: (userId: string) => `/admin/users/${id(userId)}/impersonate`,
  stopImpersonating: "/impersonation",
} as const;

/** Where each role lands after signing in. */
export const roleHome: Record<Role, string> = {
  student: "/learn",
  parent: "/family",
  teacher: "/teach",
  admin: "/admin",
};
