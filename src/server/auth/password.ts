import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing: argon2id with the OWASP-recommended minimum (19 MiB, 2 passes, 1 lane).
 * The encoded hash carries its parameters, so they can be raised later without breaking old hashes.
 */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Spends the same time as a real check when there is no account (or no password) to check against,
 * so response times don't reveal which emails and usernames exist.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("lumina-dummy-password");
  await verifyPassword(await dummyHash, password);
  return false;
}

/** Picture passwords: the three picture keys, in order, hashed like a password. */
export function pictureSecret(pictures: readonly string[]): string {
  return `pictures:${pictures.join(" ")}`;
}
