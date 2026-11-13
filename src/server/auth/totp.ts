import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238, SHA-1, 6 digits, 30-second steps): what Google
 * Authenticator, Microsoft Authenticator and 1Password expect from an otpauth:// URI.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A new 160-bit secret, base32 (what authenticator apps take). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return binary.toString().padStart(DIGITS, "0");
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

export function totpCode(secretBase32: string, now = Date.now()): string {
  return hotp(base32Decode(secretBase32), currentStep(now));
}

/**
 * Checks a code against the previous, current and next step (clock drift). Returns the matching step,
 * or null. Steps at or before `lastUsedStep` are refused, so an observed code can't be replayed.
 */
export function verifyTotp(secretBase32: string, code: string, { lastUsedStep = null, now = Date.now() }: { lastUsedStep?: number | null; now?: number } = {}): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const step = currentStep(now);
  for (const candidate of [step, step - 1, step + 1]) {
    if (lastUsedStep !== null && candidate <= lastUsedStep) continue;
    if (hotp(secret, candidate) === code) return candidate;
  }
  return null;
}

/** otpauth://totp/Lumina:name?secret=…&issuer=Lumina — the content of the QR code. */
export function otpauthUri(secretBase32: string, accountName: string, issuer = "Lumina"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params}`;
}
