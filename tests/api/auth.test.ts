import { describe, expect, it } from "vitest";
import { GET as classRoster } from "@/app/api/auth/class/[code]/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginMfa } from "@/app/api/auth/login/mfa/route";
import { POST as loginPictures } from "@/app/api/auth/login/pictures/route";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as forgot } from "@/app/api/auth/password/forgot/route";
import { POST as reset } from "@/app/api/auth/password/reset/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { POST as resend } from "@/app/api/auth/verify-email/resend/route";
import { POST as startTotp } from "@/app/api/me/mfa/totp/route";
import { POST as confirmTotp } from "@/app/api/me/mfa/totp/confirm/route";
import { GET as session } from "@/app/api/session/route";
import { totpCode } from "@/server/auth/totp";
import { getDb } from "@/server/db";
import { outbox } from "@/server/mail";
import { Browser } from "../support/browser";
import { createClass, createUser, PASSWORD, reloadUser, tokenFromEmail } from "../support/factories";

const signIn = (browser: Browser, email: string, password = PASSWORD) =>
  browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password } });

describe("sign-up and email verification", () => {
  const form = { role: "parent", display_name: "Rosa Diaz", email: "Rosa@Example.test", password: "a long enough password", accept_terms: true };

  it("creates the account, emails a link, refuses sign-in until confirmed, then confirms and signs in", async () => {
    const browser = new Browser();
    const created = await browser.call(register, { method: "POST", path: "/api/auth/register", body: form });
    expect(created.status).toBe(202);

    const user = await getDb().user.findUnique({ where: { email: "rosa@example.test" } });
    expect(user).toMatchObject({ role: "parent", displayName: "Rosa Diaz", emailVerifiedAt: null });
    expect(user!.passwordHash).toMatch(/^\$argon2id\$/);

    const early = await signIn(browser, "rosa@example.test", form.password);
    expect(early.status).toBe(403);
    expect(early.body.error.code).toBe("email_not_verified");

    const token = tokenFromEmail("rosa@example.test", /Confirm your email/);
    const verified = await browser.call(verifyEmail, { method: "POST", path: "/api/auth/verify-email", body: { token } });
    expect(verified.status).toBe(200);
    expect(verified.body).toMatchObject({ signed_in: true, user: { email: "rosa@example.test", email_verified: true, role: "parent" } });
    expect(browser.cookies.get("lumina_session")).toBe("parent");

    const sid = Browser.cookieLine(verified.headers, "lumina_sid")!;
    expect(sid).toMatch(/HttpOnly/i);
    expect(sid).toMatch(/SameSite=lax/i);
    expect(JSON.stringify(verified.body)).not.toContain(browser.cookies.get("lumina_sid"));

    const again = await browser.call(verifyEmail, { method: "POST", path: "/api/auth/verify-email", body: { token } });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe("invalid_token");
  });

  it("answers the same for an email that already has an account, and tells its owner by email", async () => {
    await createUser({ email: "taken@example.test" });
    const response = await new Browser().call(register, { method: "POST", path: "/api/auth/register", body: { ...form, email: "taken@example.test" } });
    expect(response.status).toBe(202);
    expect(outbox.map((mail) => mail.subject)).toEqual(["You already have a Lumina account"]);
    expect(await getDb().user.findMany()).toHaveLength(1);
  });

  it("validates with field details the form can show", async () => {
    const response = await new Browser().call(register, {
      method: "POST",
      path: "/api/auth/register",
      body: { ...form, email: "not-an-email", password: "short", accept_terms: false },
    });
    expect(response.status).toBe(422);
    const fields = response.body.error.details.map((detail: { field: string }) => detail.field);
    expect(fields).toEqual(expect.arrayContaining(["body.email", "body.password", "body.accept_terms"]));
    expect(response.body.error.details.find((detail: { field: string }) => detail.field === "body.password").message).toBe("Use at least 8 characters.");
  });

  it("only sends a new link to unconfirmed accounts, with the same answer either way", async () => {
    await createUser({ email: "new@example.test", emailVerifiedAt: null });
    await createUser({ email: "done@example.test" });
    const browser = new Browser();
    for (const email of ["new@example.test", "done@example.test", "nobody@example.test"]) {
      const response = await browser.call(resend, { method: "POST", path: "/api/auth/verify-email/resend", body: { email } });
      expect(response.status).toBe(202);
    }
    expect(outbox.map((mail) => mail.to)).toEqual(["new@example.test"]);
  });
});

describe("email sign-in", () => {
  it("signs in, reports the session, and signs out (ending the session server-side)", async () => {
    const user = await createUser({ role: "teacher", email: "t@example.test" });
    const browser = new Browser();
    const response = await signIn(browser, "T@Example.test");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ signed_in: true, user: { id: user.id, role: "teacher", teacher_profile: { verified: false } } });
    expect((await reloadUser(user.id))!.lastLoginAt).not.toBeNull();

    const me = await browser.call(session, { path: "/api/session" });
    expect(me.body).toMatchObject({ user: { id: user.id }, impersonating: false });

    const out = await browser.call(logout, { method: "POST", path: "/api/auth/logout" });
    expect(out.status).toBe(204);
    expect(browser.cookies.has("lumina_sid")).toBe(false);
    expect(await getDb().session.findMany()).toHaveLength(0);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await createUser({ email: "known@example.test" });
    const wrong = await signIn(new Browser(), "known@example.test", "wrong password");
    const unknown = await signIn(new Browser(), "unknown@example.test", "wrong password");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it("locks the account for a while after 10 wrong passwords, even for the right one", async () => {
    await createUser({ email: "victim@example.test" });
    const browser = new Browser();
    for (let attempt = 1; attempt < 10; attempt++) expect((await signIn(browser, "victim@example.test", `guess ${attempt}`)).status).toBe(401);
    const tenth = await signIn(browser, "victim@example.test", "guess 10");
    expect(tenth.status).toBe(429);
    expect(tenth.headers.get("retry-after")).toBeTruthy();
    expect((await signIn(browser, "victim@example.test")).status).toBe(429);
  });

  it("refuses turned-off accounts, but only after a correct password", async () => {
    await createUser({ email: "off@example.test", isActive: false });
    expect((await signIn(new Browser(), "off@example.test", "wrong")).body.error.code).toBe("invalid_credentials");
    expect((await signIn(new Browser(), "off@example.test")).body.error.code).toBe("account_disabled");
  });

  it("refuses state-changing requests from other sites (CSRF)", async () => {
    await createUser({ email: "csrf@example.test" });
    const body = { email: "csrf@example.test", password: PASSWORD };
    const noHeader = await new Browser().call(login, { method: "POST", path: "/api/auth/login", body, sameSite: false });
    expect(noHeader.status).toBe(403);
    expect(noHeader.body.error.code).toBe("cross_site_request");
    const otherOrigin = await new Browser().call(login, {
      method: "POST",
      path: "/api/auth/login",
      body,
      sameSite: false,
      headers: { origin: "https://evil.example", "x-requested-with": "lumina" },
    });
    expect(otherOrigin.status).toBe(403);
  });
});

describe("password reset", () => {
  it("emails a one-time link; the new password works, the old one doesn't, and every session ends", async () => {
    const user = await createUser({ email: "forgetful@example.test" });
    const elsewhere = new Browser();
    await signIn(elsewhere, "forgetful@example.test");

    const browser = new Browser();
    expect((await browser.call(forgot, { method: "POST", path: "/api/auth/password/forgot", body: { email: "forgetful@example.test" } })).status).toBe(202);
    expect((await browser.call(forgot, { method: "POST", path: "/api/auth/password/forgot", body: { email: "nobody@example.test" } })).status).toBe(202);
    expect(outbox).toHaveLength(1);

    const token = tokenFromEmail("forgetful@example.test", /new password/);
    const done = await browser.call(reset, { method: "POST", path: "/api/auth/password/reset", body: { token, password: "a brand new password" } });
    expect(done.status).toBe(200);
    expect((await elsewhere.call(session, { path: "/api/session" })).body.user).toBeNull();
    expect(await getDb().session.findMany({ where: { userId: user.id } })).toHaveLength(0);

    expect((await signIn(browser, "forgetful@example.test")).status).toBe(401);
    expect((await signIn(browser, "forgetful@example.test", "a brand new password")).status).toBe(200);
    const reused = await browser.call(reset, { method: "POST", path: "/api/auth/password/reset", body: { token, password: "another new password" } });
    expect(reused.status).toBe(400);
  });
});

describe("two-step verification", () => {
  async function enableMfa(email: string) {
    const browser = new Browser();
    await signIn(browser, email);
    const setup = await browser.call(startTotp, { method: "POST", path: "/api/me/mfa/totp" });
    expect(setup.status).toBe(200);
    expect(setup.body.otpauth_uri).toMatch(/^otpauth:\/\/totp\/Lumina:/);
    const confirmed = await browser.call(confirmTotp, { method: "POST", path: "/api/me/mfa/totp/confirm", body: { code: totpCode(setup.body.secret) } });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.recovery_codes).toHaveLength(10);
    return { secret: setup.body.secret as string, recoveryCodes: confirmed.body.recovery_codes as string[] };
  }

  it("asks for a code after the password, keeps the step in an httpOnly cookie, and signs in with a valid code", async () => {
    await createUser({ role: "admin", email: "mfa@example.test" });
    const { secret } = await enableMfa("mfa@example.test");

    const browser = new Browser();
    const first = await signIn(browser, "mfa@example.test");
    expect(first.body).toEqual({ mfa_required: true });
    expect(browser.cookies.has("lumina_sid")).toBe(false);
    expect(Browser.cookieLine(first.headers, "lumina_mfa")).toMatch(/HttpOnly/i);

    const wrong = await browser.call(loginMfa, { method: "POST", path: "/api/auth/login/mfa", body: { code: "000000" } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details[0].field).toBe("body.code");

    // The code used to turn MFA on can't be replayed; wait for the next step's code.
    const code = totpCode(secret, Date.now() + 30_000);
    const ok = await browser.call(loginMfa, { method: "POST", path: "/api/auth/login/mfa", body: { code } });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ signed_in: true, user: { mfa_enabled: true } });
    expect(browser.cookies.has("lumina_mfa")).toBe(false);

    const replay = new Browser();
    await signIn(replay, "mfa@example.test");
    const replayed = await replay.call(loginMfa, { method: "POST", path: "/api/auth/login/mfa", body: { code } });
    expect(replayed.status).toBe(400);
  });

  it("accepts each recovery code once", async () => {
    await createUser({ role: "teacher", email: "codes@example.test" });
    const { recoveryCodes } = await enableMfa("codes@example.test");
    const browser = new Browser();
    await signIn(browser, "codes@example.test");
    const withCode = await browser.call(loginMfa, { method: "POST", path: "/api/auth/login/mfa", body: { code: recoveryCodes[0]!.toUpperCase() } });
    expect(withCode.status).toBe(200);

    const again = new Browser();
    await signIn(again, "codes@example.test");
    expect((await again.call(loginMfa, { method: "POST", path: "/api/auth/login/mfa", body: { code: recoveryCodes[0] } })).status).toBe(400);
  });

  it("ends the step after 5 wrong codes, and refuses the step without its cookie", async () => {
    await createUser({ role: "parent", email: "guess@example.test" });
    await enableMfa("guess@example.test");
    const browser = new Browser();
    await signIn(browser, "guess@example.test");
    for (let attempt = 0; attempt < 4; attempt++) {
      expect((await browser.call(loginMfa, { method: "POST", path: "/api/auth/login/mfa", body: { code: "111111" } })).status).toBe(400);
    }
    const fifth = await browser.call(loginMfa, { method: "POST", path: "/api/auth/login/mfa", body: { code: "111111" } });
    expect(fifth.status).toBe(401);
    expect(fifth.body.error.code).toBe("mfa_expired");
    expect((await new Browser().call(loginMfa, { method: "POST", path: "/api/auth/login/mfa", body: { code: "123456" } })).status).toBe(401);
  });
});

describe("student sign-in", () => {
  it("signs students in with a username and password", async () => {
    await createUser({ role: "student", username: "maya7", gradeLevel: 2 });
    const response = await new Browser().call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username: "Maya7", password: PASSWORD } });
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ role: "student", username: "maya7", grade_level: 2 });
  });

  it("lists the class for a class code (students with pictures only) and signs in with 3 pictures", async () => {
    const teacher = await createUser({ role: "teacher" });
    const maya = await createUser({ role: "student", displayName: "Maya", password: null, pictures: ["cat", "sun", "tree"] });
    const noPictures = await createUser({ role: "student", displayName: "Zed", password: null });
    await createClass(teacher, [maya, noPictures], "MAPLE42");
    const browser = new Browser();

    const roster = await browser.call(classRoster, { path: "/api/auth/class/maple42", params: { code: "maple42" } });
    expect(roster.status).toBe(200);
    expect(roster.body.class_name).toBe("Class 1T");
    expect(roster.body.students).toEqual([{ id: maya.id, display_name: "Maya", avatar_url: null }]);
    expect(roster.body.pictures).toHaveLength(12);

    expect((await browser.call(classRoster, { path: "/api/auth/class/NOPE99", params: { code: "NOPE99" } })).status).toBe(404);

    const body = { class_code: "MAPLE42", student_id: maya.id, pictures: ["cat", "sun", "tree"] };
    const wrongOrder = await browser.call(loginPictures, { method: "POST", path: "/api/auth/login/pictures", body: { ...body, pictures: ["sun", "cat", "tree"] } });
    expect(wrongOrder.status).toBe(401);
    const ok = await browser.call(loginPictures, { method: "POST", path: "/api/auth/login/pictures", body });
    expect(ok.status).toBe(200);
    const row = await getDb().session.findFirst({ where: { userId: maya.id } });
    expect(row!.kind).toBe("classroom");
    expect(row!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(8 * 60 * 60 * 1000);
  });

  it("locks picture sign-in after 5 wrong tries (423: ask your teacher)", async () => {
    const teacher = await createUser({ role: "teacher" });
    const sam = await createUser({ role: "student", password: null, pictures: ["dog", "star", "fish"] });
    await createClass(teacher, [sam], "LOCK11");
    const browser = new Browser();
    const attempt = (pictures: string[]) =>
      browser.call(loginPictures, { method: "POST", path: "/api/auth/login/pictures", body: { class_code: "LOCK11", student_id: sam.id, pictures } });
    for (let index = 0; index < 4; index++) expect((await attempt(["cat", "sun", "moon"])).status).toBe(401);
    expect((await attempt(["cat", "sun", "moon"])).status).toBe(423);
    expect((await attempt(["dog", "star", "fish"])).status).toBe(423);
  });
});

describe("per-IP rate limits", () => {
  it("limit class code lookups per client IP, and don't lump together clients whose IP is unknown", async () => {
    const browser = new Browser();
    const lookup = (headers: Record<string, string> = {}) => browser.call(classRoster, { path: "/api/auth/class/NOPE99", params: { code: "NOPE99" }, headers });
    for (let attempt = 0; attempt < 60; attempt++) expect((await lookup({ "x-forwarded-for": "203.0.113.7" })).status).toBe(404);
    const limited = await lookup({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await lookup({ "x-forwarded-for": "198.51.100.9" })).status).toBe(404);
    expect((await lookup()).status).toBe(404);
  });
});
