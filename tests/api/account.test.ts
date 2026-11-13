import { describe, expect, it } from "vitest";
import { POST as confirmEmail } from "@/app/api/auth/email/confirm/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as changeEmail } from "@/app/api/me/email/route";
import { DELETE as disableTotp, POST as startTotp } from "@/app/api/me/mfa/totp/route";
import { POST as confirmTotp } from "@/app/api/me/mfa/totp/confirm/route";
import { POST as regenerateCodes } from "@/app/api/me/mfa/recovery-codes/route";
import { POST as changePassword } from "@/app/api/me/password/route";
import { DELETE as deleteMe, GET as me, PATCH as updateMe } from "@/app/api/me/route";
import { DELETE as endSession } from "@/app/api/me/sessions/[id]/route";
import { POST as endOthers } from "@/app/api/me/sessions/revoke-others/route";
import { GET as listSessions } from "@/app/api/me/sessions/route";
import { PATCH as teacherProfile } from "@/app/api/me/teacher-profile/route";
import { GET as session } from "@/app/api/session/route";
import { totpCode } from "@/server/auth/totp";
import { getDb } from "@/server/db";
import { outbox } from "@/server/mail";
import { Browser } from "../support/browser";
import { createCatalog, createUser, linkChild, PASSWORD, reloadUser, tokenFromEmail } from "../support/factories";

async function signedIn(email: string, userAgent?: string) {
  const browser = new Browser(userAgent);
  const response = await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password: PASSWORD } });
  expect(response.status).toBe(200);
  return browser;
}

describe("the signed-in account", () => {
  it("needs a session", async () => {
    const response = await new Browser().call(me, { path: "/api/me" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("not_authenticated");
  });

  it("updates the profile and validates language and time zone", async () => {
    await createUser({ email: "p@example.test" });
    const browser = await signedIn("p@example.test");
    const ok = await browser.call(updateMe, { method: "PATCH", path: "/api/me", body: { display_name: "  Pat  ", language: "fr", timezone: "Europe/Paris" } });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ display_name: "Pat", language: "fr", timezone: "Europe/Paris" });
    const bad = await browser.call(updateMe, { method: "PATCH", path: "/api/me", body: { language: "xx", timezone: "Mars/Olympus" } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details.map((detail: { field: string }) => detail.field).sort()).toEqual(["body.language", "body.timezone"]);
  });

  it("changes the password with the current one, and signs out the other devices", async () => {
    const user = await createUser({ email: "pw@example.test" });
    const laptop = await signedIn("pw@example.test");
    const phone = await signedIn("pw@example.test");
    const wrong = await laptop.call(changePassword, { method: "POST", path: "/api/me/password", body: { current_password: "nope", new_password: "another long password" } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details[0].field).toBe("body.current_password");

    const ok = await laptop.call(changePassword, { method: "POST", path: "/api/me/password", body: { current_password: PASSWORD, new_password: "another long password" } });
    expect(ok.status).toBe(200);
    expect((await laptop.call(session, { path: "/api/session" })).body.user.id).toBe(user.id);
    expect((await phone.call(session, { path: "/api/session" })).body.user).toBeNull();
    const events = await getDb().auditEvent.findMany({ where: { targetUserId: user.id } });
    expect(events.map((event) => event.action)).toContain("account.password_changed");
  });

  it("lists sessions with the current one marked, ends one, and ends all others", async () => {
    await createUser({ email: "s@example.test" });
    const laptop = await signedIn("s@example.test");
    const phone = await signedIn("s@example.test", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1");
    const tablet = await signedIn("s@example.test");
    const list = await laptop.call(listSessions, { path: "/api/me/sessions" });
    expect(list.body).toHaveLength(3);
    expect(list.body.filter((item: { current: boolean }) => item.current)).toHaveLength(1);
    const phoneSession = list.body.find((item: { device: string }) => item.device.includes("iPhone"));

    expect((await laptop.call(endSession, { method: "DELETE", path: "/api/me/sessions/x", params: { id: phoneSession.id } })).status).toBe(204);
    expect((await phone.call(session, { path: "/api/session" })).body.user).toBeNull();
    expect((await laptop.call(endSession, { method: "DELETE", path: "/api/me/sessions/x", params: { id: phoneSession.id } })).status).toBe(404);

    await laptop.call(endOthers, { method: "POST", path: "/api/me/sessions/revoke-others" });
    expect((await tablet.call(session, { path: "/api/session" })).body.user).toBeNull();
    expect((await laptop.call(listSessions, { path: "/api/me/sessions" })).body).toHaveLength(1);
  });

  it("changes the email only when the link sent to the new address is opened", async () => {
    const user = await createUser({ email: "old@example.test" });
    await createUser({ email: "taken@example.test" });
    const browser = await signedIn("old@example.test");
    const taken = await browser.call(changeEmail, { method: "POST", path: "/api/me/email", body: { new_email: "taken@example.test", password: PASSWORD } });
    expect(taken.status).toBe(409);
    expect(taken.body.error.details[0].field).toBe("body.new_email");

    const ok = await browser.call(changeEmail, { method: "POST", path: "/api/me/email", body: { new_email: "New@Example.test", password: PASSWORD } });
    expect(ok.status).toBe(202);
    expect((await reloadUser(user.id))!.email).toBe("old@example.test");
    // The old address is told, without a usable link.
    const notice = outbox.find((mail) => mail.to === "old@example.test");
    expect(notice?.subject).toMatch(/changing/);
    expect(notice?.text).not.toContain("token=");
    const token = tokenFromEmail("new@example.test", /Confirm your new email/);
    expect((await new Browser().call(confirmEmail, { method: "POST", path: "/api/auth/email/confirm", body: { token } })).status).toBe(200);
    expect((await reloadUser(user.id))!.email).toBe("new@example.test");
  });

  it("turns two-step verification off and makes new recovery codes with a current code", async () => {
    await createUser({ role: "teacher", email: "m@example.test" });
    const browser = await signedIn("m@example.test");
    const { body: setup } = await browser.call(startTotp, { method: "POST", path: "/api/me/mfa/totp" });
    await browser.call(confirmTotp, { method: "POST", path: "/api/me/mfa/totp/confirm", body: { code: totpCode(setup.secret) } });
    expect((await browser.call(me, { path: "/api/me" })).body.mfa_enabled).toBe(true);
    expect((await browser.call(startTotp, { method: "POST", path: "/api/me/mfa/totp" })).status).toBe(409);

    const codes = await browser.call(regenerateCodes, { method: "POST", path: "/api/me/mfa/recovery-codes", body: { code: totpCode(setup.secret, Date.now() + 30_000) } });
    expect(codes.status).toBe(200);
    expect(codes.body.recovery_codes).toHaveLength(10);

    expect((await browser.call(disableTotp, { method: "DELETE", path: "/api/me/mfa/totp", body: { code: "123456" } })).status).toBe(400);
    expect((await browser.call(disableTotp, { method: "DELETE", path: "/api/me/mfa/totp", body: { code: codes.body.recovery_codes[0] } })).status).toBe(204);
    expect((await browser.call(me, { path: "/api/me" })).body.mfa_enabled).toBe(false);
  });

  it("saves a teacher profile with known subjects only", async () => {
    await createCatalog();
    await createUser({ role: "teacher", email: "teach@example.test" });
    await createUser({ role: "parent", email: "parent@example.test" });
    const teacher = await signedIn("teach@example.test");
    const saved = await teacher.call(teacherProfile, {
      method: "PATCH",
      path: "/api/me/teacher-profile",
      body: { school_name: "Maple Primary", subjects: ["science", "mathematics"], grade_levels: [3, 1, 3], bio: null },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.teacher_profile).toEqual({ school_name: "Maple Primary", subjects: ["science", "mathematics"], grade_levels: [1, 3], bio: null, verified: false });
    const unknown = await teacher.call(teacherProfile, { method: "PATCH", path: "/api/me/teacher-profile", body: { subjects: ["alchemy"] } });
    expect(unknown.status).toBe(400);
    const parent = await signedIn("parent@example.test");
    expect((await parent.call(teacherProfile, { method: "PATCH", path: "/api/me/teacher-profile", body: {} })).status).toBe(403);
  });

  it("deletes the account with the password; children's accounts stay", async () => {
    const parent = await createUser({ email: "bye@example.test" });
    const child = await createUser({ role: "student" });
    await linkChild(parent, child);
    const browser = await signedIn("bye@example.test");
    expect((await browser.call(deleteMe, { method: "DELETE", path: "/api/me", body: { password: "wrong" } })).status).toBe(400);
    const deleted = await browser.call(deleteMe, { method: "DELETE", path: "/api/me", body: { password: PASSWORD } });
    expect(deleted.status).toBe(204);
    expect(browser.cookies.has("lumina_sid")).toBe(false);
    expect(await reloadUser(parent.id)).toBeNull();
    expect(await reloadUser(child.id)).not.toBeNull();
    expect(await getDb().guardianship.findMany()).toHaveLength(0);
  });

  it("keeps at least one admin", async () => {
    await createUser({ role: "admin", email: "only@example.test" });
    const browser = await signedIn("only@example.test");
    const refused = await browser.call(deleteMe, { method: "DELETE", path: "/api/me", body: { password: PASSWORD } });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("last_admin");
    expect(await getDb().user.findMany()).toHaveLength(1);
  });
});
