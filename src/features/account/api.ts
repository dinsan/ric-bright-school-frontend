import { bff } from "@/lib/bff";
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
  update: (body: MeUpdate) => bff<Me>(paths.me, { method: "PATCH", json: body }),
  remove: (body: AccountDeletion) => bff<void>(paths.me, { method: "DELETE", json: body }),
  changePassword: (body: PasswordChange) => bff<unknown>(paths.mePassword, { method: "POST", json: body }),
  changeEmail: (body: EmailChange) => bff<unknown>(paths.meEmail, { method: "POST", json: body }),
  sessions: () => bff<Session[]>(paths.sessions),
  endSession: (id: string) => bff<void>(paths.session(id), { method: "DELETE" }),
  endOtherSessions: () => bff<unknown>(paths.revokeOtherSessions, { method: "POST" }),
  linkedAccounts: () => bff<LinkedAccount[]>(paths.linkedAccounts),
  unlink: (provider: OAuthProvider) => bff<void>(paths.unlinkAccount(provider), { method: "DELETE" }),
  startTotp: () => bff<TotpSetup>(paths.totp, { method: "POST" }),
  confirmTotp: (code: string) => bff<RecoveryCodes>(paths.totpConfirm, { method: "POST", json: { code } }),
  disableTotp: (code: string) => bff<void>(paths.totp, { method: "DELETE", json: { code } }),
  regenerateRecoveryCodes: (code: string) => bff<RecoveryCodes>(paths.recoveryCodes, { method: "POST", json: { code } }),
  updateTeacherProfile: (body: TeacherProfileUpdate) => bff<Me>(paths.teacherProfile, { method: "PATCH", json: body }),
  createLinkCode: () => bff<LinkCode>(paths.linkCode, { method: "POST" }),
};
