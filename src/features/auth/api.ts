import { bff } from "@/lib/bff";
import {
  paths,
  type ClassRoster,
  type EmailPasswordLogin,
  type Me,
  type OAuthProviders,
  type PasswordReset,
  type PictureSignIn,
  type RegisterRequest,
  type UsernameLogin,
} from "./contract";

/** What the gateway answers after a sign-in step (tokens are never included). */
export type SignInResult = { signed_in: true; user: Me | null } | { mfa_required: true };

/** GET /api/session: who is signed in. Owned by this app's gateway, not the backend. */
export interface SessionPayload {
  user: Me | null;
  impersonating: boolean;
}

export const authApi = {
  session: () => bff<SessionPayload>("/session", { cache: "no-store" }),
  signIn: (body: EmailPasswordLogin) => bff<SignInResult>(paths.login, { method: "POST", json: body }),
  signInWithUsername: (body: UsernameLogin) => bff<SignInResult>(paths.loginUsername, { method: "POST", json: body }),
  signInWithPictures: (body: PictureSignIn) => bff<SignInResult>(paths.loginPictures, { method: "POST", json: body }),
  completeMfa: (code: string) => bff<SignInResult>(paths.loginMfa, { method: "POST", json: { code } }),
  classRoster: (classCode: string) => bff<ClassRoster>(paths.classRoster(classCode.trim().toUpperCase())),
  providers: () => bff<OAuthProviders>(paths.oauthProviders),
  register: (body: RegisterRequest) => bff<unknown>(paths.register, { method: "POST", json: body }),
  verifyEmail: (token: string) => bff<Partial<SignInResult>>(paths.verifyEmail, { method: "POST", json: { token } }),
  resendVerification: (email: string) => bff<unknown>(paths.resendVerification, { method: "POST", json: { email } }),
  forgotPassword: (email: string) => bff<unknown>(paths.passwordForgot, { method: "POST", json: { email } }),
  resetPassword: (body: PasswordReset) => bff<Partial<SignInResult>>(paths.passwordReset, { method: "POST", json: body }),
  confirmEmailChange: (token: string) => bff<unknown>(paths.emailConfirm, { method: "POST", json: { token } }),
  signOut: () => bff<void>("/auth/logout", { method: "POST" }),
  stopImpersonating: () => bff<{ user: Me }>("/impersonation", { method: "DELETE" }),
};

/** Where the browser goes to start Google / Microsoft / Apple (a full page navigation). */
export function oauthStartUrl(provider: string, { next, intent }: { next?: string | null; intent?: "link" } = {}) {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (intent) params.set("intent", intent);
  const query = params.toString();
  return `/api${paths.oauthStart(provider as never)}${query ? `?${query}` : ""}`;
}
