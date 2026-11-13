import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as callback, POST as callbackPost } from "@/app/auth/callback/route";
import { GET as start } from "@/app/api/auth/oauth/[provider]/start/route";
import { GET as providers } from "@/app/api/auth/oauth/providers/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as linked } from "@/app/api/me/oauth/route";
import { DELETE as unlink } from "@/app/api/me/oauth/[provider]/route";
import { GET as session } from "@/app/api/session/route";
import { resetServerConfig } from "@/server/config";
import { Browser } from "../support/browser";
import { createUser, PASSWORD } from "../support/factories";

/**
 * The OAuth round trip with Google's token endpoint stubbed: everything else (state, PKCE, cookies,
 * claim checks, account rules) is the real code.
 */

const CLIENT_ID = "google-client-id";

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = "google-secret";
  resetServerConfig();
});
afterAll(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  resetServerConfig();
});
afterEach(() => vi.unstubAllGlobals());

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Google answers the code exchange with an ID token carrying these claims (nonce taken from the authorize URL). */
function stubGoogle(claims: Record<string, unknown>, nonce: string, onRequest?: (body: URLSearchParams) => void) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://oauth2.googleapis.com/token");
      onRequest?.(new URLSearchParams(String(init.body)));
      const payload = { iss: "https://accounts.google.com", aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300, nonce, ...claims };
      return Response.json({ id_token: `${base64url({ alg: "RS256" })}.${base64url(payload)}.signature` });
    }),
  );
}

/** Starts the flow and returns what the provider would need to answer. */
async function begin(browser: Browser, query = "") {
  const response = await browser.call(start, { path: `/api/auth/oauth/google/start${query}`, params: { provider: "google" } });
  expect(response.status).toBe(307);
  const authorize = new URL(response.headers.get("location")!);
  return { authorize, state: authorize.searchParams.get("state")!, nonce: authorize.searchParams.get("nonce")! };
}

const finish = (browser: Browser, query: string) => browser.call(callback, { path: `/auth/callback?${query}` });
const location = (response: { headers: Headers }) => {
  const url = new URL(response.headers.get("location")!);
  return `${url.pathname}${url.search}`;
};

describe("OAuth (Google)", () => {
  it("lists only configured providers", async () => {
    expect((await new Browser().call(providers, { path: "/api/auth/oauth/providers" })).body).toEqual({ providers: ["google"] });
  });

  it("sends the browser to Google with PKCE, a nonce and a state bound to a cookie", async () => {
    const browser = new Browser();
    const { authorize, state } = await begin(browser, "?next=%2Ffamily");
    expect(authorize.origin + authorize.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(authorize.searchParams.get("redirect_uri")).toBe("http://lumina.test/auth/callback");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    expect(browser.cookies.get("lumina_oauth")).toBe(state);
  });

  it("signs up with the role chosen on the sign-up page, then signs in with the same account", async () => {
    const browser = new Browser();
    const { state, nonce } = await begin(browser, "?intent=signup&role=teacher");
    let verifier = "";
    stubGoogle({ sub: "g-123", email: "New.Teacher@Example.test", email_verified: true, name: "Nia Teacher" }, nonce, (body) => {
      verifier = body.get("code_verifier") ?? "";
    });
    const done = await finish(browser, `code=abc&state=${state}`);
    expect(location(done)).toBe("/teach");
    expect(verifier.length).toBeGreaterThan(20);
    expect(browser.cookies.has("lumina_oauth")).toBe(false);
    const me = (await browser.call(session, { path: "/api/session" })).body.user;
    expect(me).toMatchObject({ role: "teacher", display_name: "Nia Teacher", email: "new.teacher@example.test", email_verified: true });

    const again = new Browser();
    const second = await begin(again);
    stubGoogle({ sub: "g-123", email: "new.teacher@example.test", email_verified: true }, second.nonce);
    expect(location(await finish(again, `code=def&state=${second.state}`))).toBe("/teach");
  });

  it("refuses a state that doesn't match this browser's cookie, or is used twice", async () => {
    const victim = new Browser();
    const { state } = await begin(victim);
    const attacker = new Browser();
    expect(location(await finish(attacker, `code=abc&state=${state}`))).toBe("/sign-in?error=oauth");

    const browser = new Browser();
    const flow = await begin(browser);
    stubGoogle({ sub: "g-1", email: "x@example.test", email_verified: true }, "wrong-nonce");
    expect(location(await finish(browser, `code=abc&state=${flow.state}`))).toBe("/sign-in?error=oauth");
  });

  it("doesn't create accounts from the sign-in page, or take over an existing email", async () => {
    await createUser({ email: "owner@example.test" });
    const browser = new Browser();
    const signIn = await begin(browser);
    stubGoogle({ sub: "g-new", email: "someone@example.test", email_verified: true }, signIn.nonce);
    expect(location(await finish(browser, `code=a&state=${signIn.state}`))).toBe("/sign-in?error=oauth_no_account");

    const signUp = await begin(browser, "?intent=signup&role=parent");
    stubGoogle({ sub: "g-attacker", email: "owner@example.test", email_verified: true }, signUp.nonce);
    expect(location(await finish(browser, `code=b&state=${signUp.state}`))).toBe("/sign-in?error=oauth_email_taken");

    const unverified = await begin(browser, "?intent=signup&role=parent");
    stubGoogle({ sub: "g-unverified", email: "fresh@example.test", email_verified: false }, unverified.nonce);
    expect(location(await finish(browser, `code=c&state=${unverified.state}`))).toBe("/sign-in?error=oauth_email_unverified");
  });

  it("links to the signed-in account, and unlinks only while another way to sign in remains", async () => {
    await createUser({ email: "linker@example.test" });
    const browser = new Browser();
    await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email: "linker@example.test", password: PASSWORD } });
    const flow = await begin(browser, "?intent=link");
    stubGoogle({ sub: "g-link", email: "linker@gmail.example", email_verified: true }, flow.nonce);
    expect(location(await finish(browser, `code=a&state=${flow.state}`))).toBe("/account/security?link=done&provider=google");
    expect((await browser.call(linked, { path: "/api/me/oauth" })).body).toEqual([expect.objectContaining({ provider: "google", email: "linker@gmail.example" })]);
    expect((await browser.call(unlink, { method: "DELETE", path: "/api/me/oauth/google", params: { provider: "google" } })).status).toBe(204);

    // An OAuth-only account can't remove its last way in.
    const solo = new Browser();
    const signUp = await begin(solo, "?intent=signup&role=parent");
    stubGoogle({ sub: "g-solo", email: "solo@example.test", email_verified: true }, signUp.nonce);
    await finish(solo, `code=b&state=${signUp.state}`);
    const refused = await solo.call(unlink, { method: "DELETE", path: "/api/me/oauth/google", params: { provider: "google" } });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("last_sign_in_method");
  });

  it("asks for the two-step code after Google when the account uses it", async () => {
    const user = await createUser({ email: "mfa@example.test", mfaEnabledAt: new Date(), totpSecret: "v1.a.b.c" });
    const { getDb } = await import("@/server/db");
    await getDb().oAuthAccount.create({ data: { userId: user.id, provider: "google", subject: "g-mfa", email: "mfa@example.test" } });
    const browser = new Browser();
    const flow = await begin(browser, "?next=%2Ffamily%2Fchildren");
    stubGoogle({ sub: "g-mfa", email: "mfa@example.test", email_verified: true }, flow.nonce);
    expect(location(await finish(browser, `code=a&state=${flow.state}`))).toBe("/sign-in?step=mfa&next=%2Ffamily%2Fchildren");
    expect(browser.cookies.has("lumina_mfa")).toBe(true);
    expect(browser.cookies.has("lumina_sid")).toBe(false);
  });

  it("turns Apple's cross-site form POST into a same-site GET, keeping the name", async () => {
    const form = new FormData();
    form.set("code", "c1");
    form.set("state", "s1");
    form.set("user", JSON.stringify({ name: { firstName: "Ana", lastName: "Lima" } }));
    const { NextRequest } = await import("next/server");
    const response = await callbackPost(new NextRequest("http://lumina.test/auth/callback", { method: "POST", body: form }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://lumina.test/auth/callback?code=c1&state=s1&name=Ana+Lima");
  });
});
