/**
 * Everything Lumina keeps in the browser's localStorage. Shared by the code that uses each key and by
 * the cookie policy (/cookies), which lists them from here so it can't fall out of date.
 */
export const STORAGE_KEYS = {
  /** Colour theme: system, light, dark or high contrast. */
  theme: "lumina:theme",
  /** Reading level (grade band): Grades 1–5, 6–8 or 9–12. */
  band: "lumina:band",
  /** On a shared classroom device, the class code, so children start at "Who are you?". */
  classCode: "lumina:class-code",
} as const;
