import "server-only";

import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { serverConfig } from "@/server/config";

/** A random, URL-safe token with `bytes` bytes of entropy (default 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256, hex. Used to store high-entropy tokens (sessions, email links, recovery codes): never the raw value. */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Upper-case letters and digits without look-alikes (0/O, 1/I/L): easy to read aloud and type. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A random code from `alphabet`, without modulo bias. */
export function randomCode(length: number, alphabet = CODE_ALPHABET): string {
  let code = "";
  for (let index = 0; index < length; index++) code += alphabet[randomInt(alphabet.length)];
  return code;
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// --- Secrets at rest (TOTP) ---------------------------------------------------------------------------

let encryptionKey: Buffer | null = null;

function key(): Buffer {
  encryptionKey ??= Buffer.from(hkdfSync("sha256", serverConfig().AUTH_SECRET, "lumina", "lumina:secrets:v1", 32));
  return encryptionKey;
}

/** AES-256-GCM with a key derived from AUTH_SECRET. Output: "v1.<iv>.<tag>.<ciphertext>" (base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || ciphertext === undefined) throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

/** For tests that change AUTH_SECRET. */
export function resetEncryptionKey() {
  encryptionKey = null;
}
