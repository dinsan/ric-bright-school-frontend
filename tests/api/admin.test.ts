import { describe, expect, it } from "vitest";
import { POST as impersonate } from "@/app/api/admin/users/[id]/impersonate/route";
import { DELETE as resetMfa } from "@/app/api/admin/users/[id]/mfa/route";
import { GET as getUser, PATCH as updateUser } from "@/app/api/admin/users/[id]/route";
import { PUT as verifyTeacher } from "@/app/api/admin/users/[id]/teacher-verification/route";
import { GET as searchUsers } from "@/app/api/admin/users/route";
import { POST as login } from "@/app/api/auth/login/route";
import { DELETE as stopImpersonating } from "@/app/api/impersonation/route";
import { POST as changePassword } from "@/app/api/me/password/route";
import { GET as listSessions } from "@/app/api/me/sessions/route";
import { GET as session } from "@/app/api/session/route";
import { getDb } from "@/server/db";
import { Browser } from "../support/browser";
import { createUser, PASSWORD } from "../support/factories";

async function signedIn(email: string) {
  const browser = new Browser();
  expect((await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password: PASSWORD } })).status).toBe(200);
  return browser;
}

describe("admin", () => {
  it("is for admins only", async () => {
    await createUser({ role: "teacher", email: "t@example.test" });
    const teacher = await signedIn("t@example.test");
    expect((await teacher.call(searchUsers, { path: "/api/admin/users" })).status).toBe(403);
    expect((await new Browser().call(searchUsers, { path: "/api/admin/users" })).status).toBe(401);
  });

  it("searches by name, email or username, filters by role, and paginates", async () => {
    await createUser({ role: "admin", email: "admin@example.test" });
    await createUser({ role: "teacher", displayName: "Grace Hopper", email: "grace@example.test" });
    await createUser({ role: "student", displayName: "Alan", username: "hopper_fan" });
    await createUser({ role: "parent", displayName: "Someone Else" });
    const admin = await signedIn("admin@example.test");
    const byText = await admin.call(searchUsers, { path: "/api/admin/users?q=hopper" });
    expect(byText.body.total).toBe(2);
    // `_` and `%` typed in the search are letters, not LIKE wildcards (which would match everyone).
    const underscore = await admin.call(searchUsers, { path: "/api/admin/users?q=_" });
    expect(underscore.body.items.map((user: { username: string | null }) => user.username)).toEqual(["hopper_fan"]);
    expect((await admin.call(searchUsers, { path: "/api/admin/users?q=%25" })).body.total).toBe(0);
    const teachers = await admin.call(searchUsers, { path: "/api/admin/users?role=teacher" });
    expect(teachers.body.items).toHaveLength(1);
    expect(teachers.body.items[0]).toMatchObject({ display_name: "Grace Hopper", teacher_verified: false });
    const paged = await admin.call(searchUsers, { path: "/api/admin/users?limit=2&offset=2" });
    expect(paged.body).toMatchObject({ total: 4, limit: 2, offset: 2 });
    expect((await admin.call(searchUsers, { path: "/api/admin/users?role=wizard" })).status).toBe(422);
  });

  it("changes roles, turns accounts off (signing them out) and back on, and records it", async () => {
    const adminUser = await createUser({ role: "admin", email: "admin@example.test" });
    const target = await createUser({ role: "parent", email: "target@example.test" });
    const admin = await signedIn("admin@example.test");
    const targetBrowser = await signedIn("target@example.test");

    const off = await admin.call(updateUser, { method: "PATCH", path: "/api/admin/users/x", params: { id: target.id }, body: { is_active: false } });
    expect(off.status).toBe(200);
    expect(off.body.is_active).toBe(false);
    expect((await targetBrowser.call(session, { path: "/api/session" })).body.user).toBeNull();
    const refused = await new Browser().call(login, { method: "POST", path: "/api/auth/login", body: { email: "target@example.test", password: PASSWORD } });
    expect(refused.body.error.code).toBe("account_disabled");

    const promoted = await admin.call(updateUser, { method: "PATCH", path: "/api/admin/users/x", params: { id: target.id }, body: { role: "teacher", is_active: true } });
    expect(promoted.body).toMatchObject({ role: "teacher", is_active: true, teacher_verified: false });

    const self = await admin.call(updateUser, { method: "PATCH", path: "/api/admin/users/x", params: { id: adminUser.id }, body: { role: "parent" } });
    expect(self.status).toBe(403);
    expect((await admin.call(getUser, { path: "/api/admin/users/x", params: { id: "not-a-uuid" } })).status).toBe(404);

    const events = await getDb().auditEvent.findMany({ where: { actorId: adminUser.id } });
    expect(events.filter((event) => event.action === "admin.user_updated")).toHaveLength(2);
  });

  it("verifies teachers and resets two-step verification", async () => {
    await createUser({ role: "admin", email: "admin@example.test" });
    const teacher = await createUser({ role: "teacher", mfaEnabledAt: new Date(), totpSecret: "v1.x.y.z" });
    const parent = await createUser({ role: "parent" });
    const admin = await signedIn("admin@example.test");
    const verified = await admin.call(verifyTeacher, { method: "PUT", path: "/api/admin/users/x/teacher-verification", params: { id: teacher.id }, body: { verified: true } });
    expect(verified.body.teacher_verified).toBe(true);
    expect((await admin.call(verifyTeacher, { method: "PUT", path: "/api/admin/users/x/teacher-verification", params: { id: parent.id }, body: { verified: true } })).status).toBe(409);

    expect((await admin.call(resetMfa, { method: "DELETE", path: "/api/admin/users/x/mfa", params: { id: teacher.id } })).status).toBe(204);
    expect((await admin.call(getUser, { path: "/api/admin/users/x", params: { id: teacher.id } })).body.mfa_enabled).toBe(false);
  });

  it("views as a user for support, can't change their credentials, and returns to the admin session", async () => {
    const adminUser = await createUser({ role: "admin", email: "admin@example.test" });
    const otherAdmin = await createUser({ role: "admin" });
    const parent = await createUser({ role: "parent", email: "parent@example.test" });
    const admin = await signedIn("admin@example.test");

    expect((await admin.call(impersonate, { method: "POST", path: "/api/admin/users/x/impersonate", params: { id: otherAdmin.id } })).status).toBe(403);

    const started = await admin.call(impersonate, { method: "POST", path: "/api/admin/users/x/impersonate", params: { id: parent.id } });
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({ signed_in: true, user: { id: parent.id } });
    expect(admin.cookies.get("lumina_session")).toBe("parent");
    expect(admin.cookies.has("lumina_imp")).toBe(true);
    expect((await admin.call(session, { path: "/api/session" })).body).toMatchObject({ user: { id: parent.id }, impersonating: true });

    const blocked = await admin.call(changePassword, { method: "POST", path: "/api/me/password", body: { current_password: PASSWORD, new_password: "hijacked password" } });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("impersonation_restricted");

    // The parent doesn't see the admin's session in their own list.
    const parentBrowser = await signedIn("parent@example.test");
    expect((await parentBrowser.call(listSessions, { path: "/api/me/sessions" })).body).toHaveLength(1);

    const stopped = await admin.call(stopImpersonating, { method: "DELETE", path: "/api/impersonation" });
    expect(stopped.status).toBe(200);
    expect(stopped.body.user.id).toBe(adminUser.id);
    expect(admin.cookies.has("lumina_imp")).toBe(false);
    expect((await admin.call(session, { path: "/api/session" })).body).toMatchObject({ user: { id: adminUser.id }, impersonating: false });

    const actions = (await getDb().auditEvent.findMany({ where: { actorId: adminUser.id } })).map((event) => event.action);
    expect(actions).toEqual(expect.arrayContaining(["admin.impersonation_started", "admin.impersonation_stopped"]));
  });
});
