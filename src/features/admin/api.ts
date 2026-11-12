import { bff } from "@/lib/bff";
import { paths, type AdminUser, type AdminUserUpdate, type Me, type Role, type UserPage } from "@/features/auth/contract";

export interface UserSearch {
  q?: string;
  role?: Role;
  limit: number;
  offset: number;
}

export const adminApi = {
  users: ({ q, role, limit, offset }: UserSearch) =>
    bff<UserPage>(paths.adminUsers, { searchParams: { q, role, limit, offset } }),
  user: (id: string) => bff<AdminUser>(paths.adminUser(id)),
  update: (id: string, body: AdminUserUpdate) => bff<AdminUser>(paths.adminUser(id), { method: "PATCH", json: body }),
  verifyTeacher: (id: string, verified: boolean) =>
    bff<AdminUser>(paths.adminTeacherVerification(id), { method: "PUT", json: { verified } }),
  resetMfa: (id: string) => bff<void>(paths.adminMfa(id), { method: "DELETE" }),
  impersonate: (id: string) => bff<{ signed_in: true; user: Me | null }>(paths.adminImpersonate(id), { method: "POST", json: {} }),
};
