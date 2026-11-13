import { apiFetch } from "@/lib/api-client";
import { paths, type AdminUser, type AdminUserUpdate, type Me, type Role, type UserPage } from "@/features/auth/contract";

export interface UserSearch {
  q?: string;
  role?: Role;
  limit: number;
  offset: number;
}

export const adminApi = {
  users: ({ q, role, limit, offset }: UserSearch) =>
    apiFetch<UserPage>(paths.adminUsers, { searchParams: { q, role, limit, offset } }),
  user: (id: string) => apiFetch<AdminUser>(paths.adminUser(id)),
  update: (id: string, body: AdminUserUpdate) => apiFetch<AdminUser>(paths.adminUser(id), { method: "PATCH", json: body }),
  verifyTeacher: (id: string, verified: boolean) =>
    apiFetch<AdminUser>(paths.adminTeacherVerification(id), { method: "PUT", json: { verified } }),
  resetMfa: (id: string) => apiFetch<void>(paths.adminMfa(id), { method: "DELETE" }),
  impersonate: (id: string) => apiFetch<{ signed_in: true; user: Me | null }>(paths.adminImpersonate(id), { method: "POST", json: {} }),
};
