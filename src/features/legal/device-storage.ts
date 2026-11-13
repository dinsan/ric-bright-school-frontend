import "server-only";

import { CLASSROOM_SESSION_SECONDS, COOKIE, IMPERSONATION_SESSION_SECONDS, MFA_SECONDS, SESSION_SECONDS } from "@/server/auth/cookies";
import { STORAGE_KEYS } from "@/lib/storage-keys";

/**
 * Everything Lumina stores in a browser, for the cookie policy. Built from the constants the code uses
 * (cookie names and lifetimes, localStorage keys), and checked by tests/unit/legal.test.ts: adding a
 * cookie or key without describing it here fails the tests.
 */

export interface StoredItem {
  name: string;
  kind: "Cookie" | "Local storage";
  purpose: string;
  duration: string;
}

export function formatDuration(seconds: number): string {
  const units: Array<[number, string]> = [
    [24 * 60 * 60, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ];
  for (const [size, unit] of units) {
    if (seconds >= size && seconds % size === 0) {
      const value = seconds / size;
      return `${value} ${unit}${value === 1 ? "" : "s"}`;
    }
  }
  return `${seconds} seconds`;
}

export const cookies: StoredItem[] = [
  {
    name: COOKIE.session,
    kind: "Cookie",
    purpose: "Keeps you signed in. A random code that only our server can match to your account; your browser's scripts can't read it.",
    duration: `${formatDuration(SESSION_SECONDS)} from your last visit (${formatDuration(CLASSROOM_SESSION_SECONDS)} after signing in with a class code and pictures), or until you sign out`,
  },
  {
    name: COOKIE.hint,
    kind: "Cookie",
    purpose: "Remembers which kind of account is signed in (for example \"parent\"), so the page can show the right menu straight away. It contains nothing else.",
    duration: "Same as the sign-in cookie",
  },
  {
    name: COOKIE.mfa,
    kind: "Cookie",
    purpose: "Holds your place between typing your password and entering the code from your authenticator app (two-step verification).",
    duration: formatDuration(MFA_SECONDS),
  },
  {
    name: COOKIE.oauth,
    kind: "Cookie",
    purpose: "Checks that a sign-in with Google, Microsoft or Apple that comes back to Lumina was started in this browser.",
    duration: formatDuration(MFA_SECONDS),
  },
  {
    name: COOKIE.impersonator,
    kind: "Cookie",
    purpose: "Only for Lumina support staff: keeps their own sign-in while they look at Lumina as someone they are helping.",
    duration: formatDuration(IMPERSONATION_SESSION_SECONDS),
  },
];

export const localStorageItems: StoredItem[] = [
  {
    name: STORAGE_KEYS.theme,
    kind: "Local storage",
    purpose: "Your colour choice: match my device, light, dark or high contrast.",
    duration: "Until you change it or clear your browser's data",
  },
  {
    name: STORAGE_KEYS.band,
    kind: "Local storage",
    purpose: "Your reading level (Grades 1–5, 6–8 or 9–12), which sets text size and spacing.",
    duration: "Until you change it or clear your browser's data",
  },
  {
    name: STORAGE_KEYS.classCode,
    kind: "Local storage",
    purpose: "Only when \"This is a classroom device\" is ticked at class sign-in: the class code, so children on a shared device start at \"Who are you?\".",
    duration: "Until someone chooses \"Change the class code\", or the browser's data is cleared",
  },
];
