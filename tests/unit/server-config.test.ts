import { afterEach, describe, expect, it } from "vitest";
import { hashPassword, pictureSecret, verifyAgainstDummy, verifyPassword } from "@/server/auth/password";
import { resetServerConfig, serverConfig } from "@/server/config";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  resetServerConfig();
});

function configWith(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetServerConfig();
  return serverConfig();
}

describe("server configuration", () => {
  it("needs DATABASE_URL, and says so", () => {
    expect(() => configWith({ DATABASE_URL: undefined })).toThrow(/DATABASE_URL is required/);
  });

  it("uses a development AUTH_SECRET outside production, and requires a real one in production (not while building)", () => {
    expect(configWith({ NODE_ENV: "development", AUTH_SECRET: undefined }).AUTH_SECRET).toMatch(/development/);
    expect(() => configWith({ NODE_ENV: "production", AUTH_SECRET: undefined, NEXT_PHASE: undefined })).toThrow(/AUTH_SECRET is required in production/);
    expect(() => configWith({ NODE_ENV: "production", AUTH_SECRET: undefined, NEXT_PHASE: "phase-production-build" })).not.toThrow();
    expect(() => configWith({ NODE_ENV: "production", AUTH_SECRET: "too-short" })).toThrow(/at least 32 characters/);
  });

  it("picks the email transport: SMTP when configured, else the log (or memory in tests)", () => {
    expect(configWith({ NODE_ENV: "development", MAIL_TRANSPORT: undefined, SMTP_URL: "smtp://mail:1025" }).MAIL_TRANSPORT).toBe("smtp");
    expect(configWith({ NODE_ENV: "development", MAIL_TRANSPORT: undefined, SMTP_URL: undefined }).MAIL_TRANSPORT).toBe("log");
    expect(configWith({ NODE_ENV: "test", MAIL_TRANSPORT: undefined, SMTP_URL: undefined }).MAIL_TRANSPORT).toBe("memory");
  });

  it("treats empty values from Compose (VAR=) as not set, and normalises APP_URL and the Apple key", () => {
    const config = configWith({ GOOGLE_CLIENT_ID: "", APP_URL: "https://lumina.example/", APPLE_PRIVATE_KEY: "-----BEGIN-----\\nabc\\n-----END-----" });
    expect(config.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(config.APP_URL).toBe("https://lumina.example");
    expect(config.APPLE_PRIVATE_KEY).toBe("-----BEGIN-----\nabc\n-----END-----");
  });
});

describe("passwords", () => {
  it("are stored as argon2id hashes that verify, and never as the password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword(hash, "correct horse battery")).resolves.toBe(true);
    await expect(verifyPassword(hash, "Correct horse battery")).resolves.toBe(false);
    await expect(verifyPassword("not a hash", "anything")).resolves.toBe(false);
    await expect(verifyAgainstDummy("anything")).resolves.toBe(false);
  });

  it("treat the order of picture passwords as part of the secret", async () => {
    expect(pictureSecret(["cat", "sun", "tree"])).not.toBe(pictureSecret(["sun", "cat", "tree"]));
    const hash = await hashPassword(pictureSecret(["cat", "sun", "tree"]));
    await expect(verifyPassword(hash, pictureSecret(["tree", "sun", "cat"]))).resolves.toBe(false);
  });
});
