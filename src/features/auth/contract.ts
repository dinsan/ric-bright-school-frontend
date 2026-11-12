/**
 * The accounts API contract, in one place.
 *
 * Paths come from the backend's endpoint list. Request and response SHAPES were not available when
 * this was written, so they are assumptions, each marked ASSUMED. Confirm them against the backend's
 * /openapi.json (or generate these types from it, FE-API-01) and fix them here; the rest of the app
 * only uses these types and paths. The checklist is in docs/auth.md.
 *
 * Paths are relative to the API prefix (API_PREFIX, default "/api/v1"), like the catalog endpoints.
 */

export type Role = "student" | "parent" | "teacher" | "admin";

// --- Tokens -------------------------------------------------------------------------------------

/**
 * ASSUMED: every endpoint that signs someone in returns this (OAuth2 style). The server-side
 * proxy detects `access_token` in ANY response, stores the tokens in httpOnly cookies and removes
 * them before the browser sees the body, so a different set of endpoints returning tokens still works.
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: "bearer";
  /** Seconds until the access token expires. ASSUMED; when missing, the JWT `exp` or 15 minutes is used. */
  expires_in?: number;
  /** Seconds until the refresh token expires. ASSUMED; when missing, 30 days. */
  refresh_expires_in?: number;
}

/** ASSUMED: /auth/login answers this instead of tokens when the account has MFA switched on. */
export interface MfaChallenge {
  mfa_required: true;
  /** Short-lived token for /auth/login/mfa. The proxy keeps it in an httpOnly cookie too. */
  mfa_token: string;
}

// --- Accounts -------------------------------------------------------------------------------------

/** ASSUMED shape of GET /me. */
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
  subjects: string[];
  grade_levels: number[];
  bio: string | null;
  /** Set by an admin (PUT /admin/users/{id}/teacher-verification). */
  verified: boolean;
}

/** ASSUMED fields accepted by PATCH /me. */
export interface MeUpdate {
  display_name?: string;
  language?: string;
  timezone?: string;
}

export interface Session {
  id: string;
  current: boolean;
  device: string | null; // e.g. "Chrome on Windows"; ASSUMED
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

/** ASSUMED shape of GET /auth/oauth/providers: the providers the backend has keys for. */
export interface OAuthProviders {
  providers: OAuthProvider[];
}

/** ASSUMED response of POST /me/mfa/totp. */
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
  /** How the child signs in; null until a parent sets it up. ASSUMED. */
  sign_in_method: ChildSignInMethod | null;
}

/** ASSUMED body of POST /me/children. Adding a child is also the parent's consent (FE-AUTH-07). */
export interface ChildCreate {
  display_name: string;
  grade_level: number;
  /** Parent or guardian confirms they may create the account and agree to the terms. ASSUMED field. */
  parental_consent: true;
}

/** ASSUMED body of PUT /me/children/{child_id}/sign-in. */
export type ChildSignInSetup =
  | { method: "password"; username: string; password: string }
  | { method: "pictures"; username: string; pictures: [PictureKey, PictureKey, PictureKey] };

/** ASSUMED response of POST /me/link-code (a student creates it for a parent). */
export interface LinkCode {
  code: string;
  expires_at: string;
}

// --- Classroom sign-in (class code + 3 pictures) ---------------------------------------------------------

/**
 * NOT IN THE ENDPOINT LIST: the classroom picture sign-in was described but its endpoints were not
 * listed. ASSUMED design:
 *   GET  /auth/class/{class_code}   -> ClassRoster (who is in the class, and the picture set)
 *   POST /auth/login/pictures       -> TokenResponse, body PictureSignIn
 * Pictures are identified by key; the images themselves live in the app (features/auth/pictures.tsx).
 */
export type PictureKey = string;

export interface ClassRoster {
  class_name: string;
  students: Array<{ id: string; display_name: string; avatar_url?: string | null }>;
  /** The pictures to show, in display order. ASSUMED; when missing the app's full set is shown. */
  pictures?: PictureKey[];
}

export interface PictureSignIn {
  class_code: string;
  student_id: string;
  /** The three pictures, in the order tapped. ASSUMED: order matters. */
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

/** ASSUMED: GET /admin/users uses the same page envelope as the catalog. Query: q, role, limit, offset. */
export interface UserPage {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

// --- Request bodies (all ASSUMED) -------------------------------------------------------------------

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
/** `code` is a 6-digit authenticator code or a recovery code. The proxy adds `mfa_token` from its cookie. */
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
/** POST /auth/oauth/exchange and POST /me/oauth/{provider}/link: the one-time code from the callback. */
export interface OAuthCode {
  code: string;
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
 * OAuth (ASSUMED flow): the browser goes to /auth/oauth/{provider}/start?redirect_uri=<web>/auth/callback
 * (plus &intent=link when linking); the backend redirects to the provider and finally back to
 * redirect_uri with ?code=<one-time code>&provider=<provider>. The callback route exchanges the code
 * (sign-in/sign-up) or posts it to /me/oauth/{provider}/link (linking).
 */
export const OAUTH_CALLBACK_PATH = "/auth/callback";

// --- Paths ------------------------------------------------------------------------------------------

const id = (value: string) => encodeURIComponent(value);

export const paths = {
  register: "/auth/register",
  verifyEmail: "/auth/verify-email",
  resendVerification: "/auth/verify-email/resend",
  login: "/auth/login",
  loginUsername: "/auth/login/username",
  loginMfa: "/auth/login/mfa",
  loginPictures: "/auth/login/pictures", // ASSUMED (not in the list)
  classRoster: (classCode: string) => `/auth/class/${id(classCode)}`, // ASSUMED (not in the list)
  oauthProviders: "/auth/oauth/providers",
  oauthStart: (provider: OAuthProvider) => `/auth/oauth/${id(provider)}/start`,
  oauthExchange: "/auth/oauth/exchange",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
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
  linkAccount: (provider: OAuthProvider) => `/me/oauth/${id(provider)}/link`,
  unlinkAccount: (provider: OAuthProvider) => `/me/oauth/${id(provider)}`,
  totp: "/me/mfa/totp",
  totpConfirm: "/me/mfa/totp/confirm",
  recoveryCodes: "/me/mfa/recovery-codes",
  teacherProfile: "/me/teacher-profile",
  children: "/me/children",
  childSignIn: (childId: string) => `/me/children/${id(childId)}/sign-in`,
  linkChild: "/me/children/link",
  activeChild: "/me/active-child",
  linkCode: "/me/link-code",

  adminUsers: "/admin/users",
  adminUser: (userId: string) => `/admin/users/${id(userId)}`,
  adminTeacherVerification: (userId: string) => `/admin/users/${id(userId)}/teacher-verification`,
  adminMfa: (userId: string) => `/admin/users/${id(userId)}/mfa`,
  adminImpersonate: (userId: string) => `/admin/users/${id(userId)}/impersonate`,
} as const;

/** Where each role lands after signing in. */
export const roleHome: Record<Role, string> = {
  student: "/learn",
  parent: "/family",
  teacher: "/teach",
  admin: "/admin",
};
