import { apiFetch } from "@/lib/api-client";
import {
  paths,
  type AccountDeletion,
  type EmailChange,
  type LinkCode,
  type LinkedAccount,
  type Me,
  type MeUpdate,
  type OAuthProvider,
  type PasswordChange,
  type RecoveryCodes,
  type Session,
  type TeacherProfileUpdate,
  type TotpSetup,
} from "@/features/auth/contract";

export const accountApi = {
  update: (body: MeUpdate) => apiFetch<Me>(paths.me, { method: "PATCH", json: body }),
  remove: (body: AccountDeletion) => apiFetch<void>(paths.me, { method: "DELETE", json: body }),
  changePassword: (body: PasswordChange) => apiFetch<unknown>(paths.mePassword, { method: "POST", json: body }),
  changeEmail: (body: EmailChange) => apiFetch<unknown>(paths.meEmail, { method: "POST", json: body }),
  sessions: () => apiFetch<Session[]>(paths.sessions),
  endSession: (id: string) => apiFetch<void>(paths.session(id), { method: "DELETE" }),
  endOtherSessions: () => apiFetch<unknown>(paths.revokeOtherSessions, { method: "POST" }),
  linkedAccounts: () => apiFetch<LinkedAccount[]>(paths.linkedAccounts),
  unlink: (provider: OAuthProvider) => apiFetch<void>(paths.unlinkAccount(provider), { method: "DELETE" }),
  startTotp: () => apiFetch<TotpSetup>(paths.totp, { method: "POST" }),
  confirmTotp: (code: string) => apiFetch<RecoveryCodes>(paths.totpConfirm, { method: "POST", json: { code } }),
  disableTotp: (code: string) => apiFetch<void>(paths.totp, { method: "DELETE", json: { code } }),
  regenerateRecoveryCodes: (code: string) => apiFetch<RecoveryCodes>(paths.recoveryCodes, { method: "POST", json: { code } }),
  updateTeacherProfile: (body: TeacherProfileUpdate) => apiFetch<Me>(paths.teacherProfile, { method: "PATCH", json: body }),
  createLinkCode: () => apiFetch<LinkCode>(paths.linkCode, { method: "POST" }),
};
