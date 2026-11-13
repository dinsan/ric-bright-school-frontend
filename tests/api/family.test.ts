import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as loginUsername } from "@/app/api/auth/login/username/route";
import { PUT as activeChild } from "@/app/api/me/active-child/route";
import { PUT as setUpSignIn } from "@/app/api/me/children/[id]/sign-in/route";
import { POST as linkChild } from "@/app/api/me/children/link/route";
import { GET as listChildren, POST as addChild } from "@/app/api/me/children/route";
import { POST as linkCode } from "@/app/api/me/link-code/route";
import { GET as me } from "@/app/api/me/route";
import { Browser } from "../support/browser";
import { createUser, PASSWORD } from "../support/factories";

async function signedIn(email: string) {
  const browser = new Browser();
  expect((await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password: PASSWORD } })).status).toBe(200);
  return browser;
}

describe("families", () => {
  it("adds a child (with consent), sets up sign-in, and the child can sign in", async () => {
    await createUser({ email: "mum@example.test" });
    const parent = await signedIn("mum@example.test");
    const noConsent = await parent.call(addChild, { method: "POST", path: "/api/me/children", body: { display_name: "Ana", grade_level: 2 } });
    expect(noConsent.status).toBe(422);
    expect(noConsent.body.error.details[0].field).toBe("body.parental_consent");

    const added = await parent.call(addChild, { method: "POST", path: "/api/me/children", body: { display_name: "Ana", grade_level: 2, parental_consent: true } });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ display_name: "Ana", grade_level: 2, username: null, sign_in_method: null });
    expect((await parent.call(me, { path: "/api/me" })).body.active_child_id).toBe(added.body.id);

    const pictures = await parent.call(setUpSignIn, {
      method: "PUT",
      path: "/api/me/children/x/sign-in",
      params: { id: added.body.id },
      body: { method: "pictures", username: "Ana2", pictures: ["cat", "cat", "sun"] },
    });
    expect(pictures.status).toBe(422);
    expect(pictures.body.error.details[0].field).toBe("body.pictures");

    const withPassword = await parent.call(setUpSignIn, {
      method: "PUT",
      path: "/api/me/children/x/sign-in",
      params: { id: added.body.id },
      body: { method: "password", username: "Ana2", password: "ana's password" },
    });
    expect(withPassword.status).toBe(200);
    expect(withPassword.body).toMatchObject({ username: "ana2", sign_in_method: "password" });

    const child = await new Browser().call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username: "ana2", password: "ana's password" } });
    expect(child.status).toBe(200);
    expect(child.body.user).toMatchObject({ role: "student", grade_level: 2 });
  });

  it("refuses a username someone else has", async () => {
    await createUser({ role: "student", username: "taken1" });
    await createUser({ email: "dad@example.test" });
    const parent = await signedIn("dad@example.test");
    const { body: kid } = await parent.call(addChild, { method: "POST", path: "/api/me/children", body: { display_name: "Bo", grade_level: 5, parental_consent: true } });
    const clash = await parent.call(setUpSignIn, {
      method: "PUT",
      path: "/api/me/children/x/sign-in",
      params: { id: kid.id },
      body: { method: "password", username: "taken1", password: "bo's password" },
    });
    expect(clash.status).toBe(409);
    expect(clash.body.error.details[0].field).toBe("body.username");
  });

  it("only manages the parent's own children", async () => {
    const stranger = await createUser({ role: "student" });
    await createUser({ email: "nosy@example.test" });
    const parent = await signedIn("nosy@example.test");
    const response = await parent.call(setUpSignIn, {
      method: "PUT",
      path: "/api/me/children/x/sign-in",
      params: { id: stranger.id },
      body: { method: "password", username: "stolen", password: "some password" },
    });
    expect(response.status).toBe(404);
    expect((await parent.call(activeChild, { method: "PUT", path: "/api/me/active-child", body: { child_id: stranger.id } })).status).toBe(404);
  });

  it("links a student account with the code the student made (once)", async () => {
    await createUser({ role: "student", username: "kid9", displayName: "Kid" });
    await createUser({ email: "parent@example.test" });
    const student = new Browser();
    await student.call(loginUsername, { method: "POST", path: "/api/auth/login/username", body: { username: "kid9", password: PASSWORD } });
    const code = await student.call(linkCode, { method: "POST", path: "/api/me/link-code" });
    expect(code.status).toBe(201);
    expect(code.body.code).toMatch(/^[A-Z2-9]{8}$/);

    const parent = await signedIn("parent@example.test");
    const linked = await parent.call(linkChild, { method: "POST", path: "/api/me/children/link", body: { code: ` ${code.body.code.toLowerCase()} ` } });
    expect(linked.status).toBe(200);
    expect(linked.body.display_name).toBe("Kid");
    expect((await parent.call(listChildren, { path: "/api/me/children" })).body).toHaveLength(1);
    const reused = await parent.call(linkChild, { method: "POST", path: "/api/me/children/link", body: { code: code.body.code } });
    expect(reused.status).toBe(400);
    expect(reused.body.error.details[0].field).toBe("body.code");
  });

  it("keeps family endpoints for parents", async () => {
    await createUser({ role: "teacher", email: "teacher@example.test" });
    const teacher = await signedIn("teacher@example.test");
    expect((await teacher.call(listChildren, { path: "/api/me/children" })).status).toBe(403);
    expect((await teacher.call(linkCode, { method: "POST", path: "/api/me/link-code" })).status).toBe(403);
  });
});
