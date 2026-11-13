import { apiFetch } from "@/lib/api-client";
import {
  paths,
  type ClassRoster,
  type EmailPasswordLogin,
  type Me,
  type OAuthIntent,
  type OAuthProviders,
  type PasswordReset,
  type PictureSignIn,
  type RegisterRequest,
  type SessionPayload,
  type SignInResult,
  type UsernameLogin,
} from "./contract";

export type { SessionPayload, SignInResult };

export const authApi = {
  session: () => apiFetch<SessionPayload>(paths.currentSession, { cache: "no-store" }),
  signIn: (body: EmailPasswordLogin) => apiFetch<SignInResult>(paths.login, { method: "POST", json: body }),
  signInWithUsername: (body: UsernameLogin) => apiFetch<SignInResult>(paths.loginUsername, { method: "POST", json: body }),
  signInWithPictures: (body: PictureSignIn) => apiFetch<SignInResult>(paths.loginPictures, { method: "POST", json: body }),
  completeMfa: (code: string) => apiFetch<SignInResult>(paths.loginMfa, { method: "POST", json: { code } }),
  classRoster: (classCode: string) => apiFetch<ClassRoster>(paths.classRoster(classCode.trim().toUpperCase())),
  providers: () => apiFetch<OAuthProviders>(paths.oauthProviders),
  register: (body: RegisterRequest) => apiFetch<unknown>(paths.register, { method: "POST", json: body }),
  verifyEmail: (token: string) => apiFetch<Partial<SignInResult>>(paths.verifyEmail, { method: "POST", json: { token } }),
  resendVerification: (email: string) => apiFetch<unknown>(paths.resendVerification, { method: "POST", json: { email } }),
  forgotPassword: (email: string) => apiFetch<unknown>(paths.passwordForgot, { method: "POST", json: { email } }),
  resetPassword: (body: PasswordReset) => apiFetch<Partial<SignInResult>>(paths.passwordReset, { method: "POST", json: body }),
  confirmEmailChange: (token: string) => apiFetch<unknown>(paths.emailConfirm, { method: "POST", json: { token } }),
  signOut: () => apiFetch<void>(paths.logout, { method: "POST" }),
  stopImpersonating: () => apiFetch<{ user: Me }>(paths.stopImpersonating, { method: "DELETE" }),
};

/** Where the browser goes to start Google / Microsoft / Apple (a full page navigation). */
export function oauthStartUrl(
  provider: string,
  { next, intent, role }: { next?: string | null; intent?: OAuthIntent; role?: "parent" | "teacher" | null } = {},
) {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (intent && intent !== "signin") params.set("intent", intent);
  if (intent === "signup" && role) params.set("role", role);
  const query = params.toString();
  return `/api${paths.oauthStart(provider as never)}${query ? `?${query}` : ""}`;
}
