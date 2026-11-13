import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, randomCode } from "@/server/auth/crypto";
import { base32Decode, base32Encode, hotp, otpauthUri, verifyTotp } from "@/server/auth/totp";
import { isSameSite } from "@/server/http/request";
import { validateClaims } from "@/server/oauth/service";
import { safeNextPath } from "@/lib/safe-redirect";

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 appendix B, SHA-1 seed "12345678901234567890"; the 6-digit codes are the last 6 digits.
  const seed = base32Encode(Buffer.from("12345678901234567890"));
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("at %i s the code is %s", (seconds, code) => {
    expect(hotp(base32Decode(seed), Math.floor(seconds / 30))).toBe(code);
    expect(verifyTotp(seed, code, { now: seconds * 1000 })).toBe(Math.floor(seconds / 30));
  });

  it("accepts one step of clock drift, refuses more, and refuses replays", () => {
    const now = 1234567890 * 1000;
    const step = Math.floor(now / 30000);
    const next = hotp(base32Decode(seed), step + 1);
    expect(verifyTotp(seed, next, { now })).toBe(step + 1);
    expect(verifyTotp(seed, hotp(base32Decode(seed), step + 2), { now })).toBeNull();
    expect(verifyTotp(seed, "005924", { now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(seed, "12345", { now })).toBeNull();
  });

  it("round-trips base32 and builds an otpauth URI", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255, 7, 99]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(otpauthUri("ABC", "ana@example.test")).toBe("otpauth://totp/Lumina:ana%40example.test?secret=ABC&issuer=Lumina&algorithm=SHA1&digits=6&period=30");
  });
});

describe("secrets at rest", () => {
  it("encrypts with a fresh IV each time and detects tampering", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP");
    const b = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("JBSWY3DPEHPK3PXP");
    const [version, iv, tag, data] = a.split(".");
    const tampered = [version, iv, tag, `${data!.slice(0, -2)}AA`].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("makes codes from the readable alphabet", () => {
    expect(randomCode(200)).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
  });
});

describe("OAuth ID token checks", () => {
  const config = { clientId: "client-1", issuerMatches: (claims: { iss?: string }) => claims.iss === "https://accounts.google.com" };
  const good = { iss: "https://accounts.google.com", aud: "client-1", sub: "123", exp: Date.now() / 1000 + 300, nonce: "n1" };
  it("accepts matching claims", () => expect(() => validateClaims(config, good, "n1")).not.toThrow());
  it.each([
    ["issuer", { iss: "https://evil.example" }],
    ["audience", { aud: "someone-else" }],
    ["expiry", { exp: Date.now() / 1000 - 3600 }],
    ["nonce", { nonce: "other" }],
    ["subject", { sub: "" }],
  ])("refuses a wrong %s", (_name, patch) => {
    expect(() => validateClaims(config, { ...good, ...patch }, "n1")).toThrow();
  });
});

describe("request safety", () => {
  const request = (method: string, headers: Record<string, string>) => new Request("http://lumina.test/api/x", { method, headers: { host: "lumina.test", ...headers } });
  it("lets reads through and checks writes for the app header and a same-site origin", () => {
    expect(isSameSite(request("GET", {}))).toBe(true);
    expect(isSameSite(request("POST", { origin: "http://lumina.test", "x-requested-with": "lumina" }))).toBe(true);
    expect(isSameSite(request("POST", { origin: "http://lumina.test" }))).toBe(false);
    expect(isSameSite(request("POST", { origin: "http://evil.test", "x-requested-with": "lumina" }))).toBe(false);
    expect(isSameSite(request("DELETE", { "x-requested-with": "lumina" }))).toBe(false);
  });

  it("only follows same-site relative redirects", () => {
    expect(safeNextPath("/family?tab=1")).toBe("/family?tab=1");
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "family", null]) expect(safeNextPath(bad)).toBeNull();
  });
});
