/**
 * Display preferences: colour theme and grade band (age-appropriate presentation).
 *
 * The source of truth on the page is two attributes on <html>, set before first paint by
 * `preferencesScript` (rendered in the root layout) so there is no flash of the wrong theme:
 *   data-theme  = "light" | "dark" | "contrast"   (resolved; drives the colour tokens)
 *   data-band   = "elementary" | "middle" | "high" (drives type scale, target size, density)
 * plus data-theme-preference, which remembers "system" separately from what it resolved to.
 *
 * Choices are remembered in localStorage. When accounts exist (Phase 3), the student profile
 * sets the band with `setGradeBand(gradeBandForGrade(profile.grade))`.
 */

import { STORAGE_KEYS } from "./storage-keys";

export const THEME_PREFERENCES = ["system", "light", "dark", "contrast"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const GRADE_BAND_IDS = ["elementary", "middle", "high"] as const;
export type GradeBandId = (typeof GRADE_BAND_IDS)[number];

const THEME_KEY = STORAGE_KEYS.theme;
const BAND_KEY = STORAGE_KEYS.band;

export interface Preferences {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  band: GradeBandId;
}

export const DEFAULT_PREFERENCES: Preferences = { theme: "system", resolvedTheme: "light", band: "middle" };

/** Grades 1–5 elementary, 6–8 middle, 9–12 high. */
export function gradeBandForGrade(grade: number): GradeBandId {
  if (grade <= 5) return "elementary";
  if (grade <= 8) return "middle";
  return "high";
}

/*
 * Reads storage and sets the attributes. Serialised into an inline <script>, so it must be
 * self-contained: no imports and no variables from outside the function.
 * "system" follows the OS: dark if it asks for dark, high contrast if it asks for more contrast.
 */
function applyStoredPreferences(themeKey: string, bandKey: string, themeOverride?: string | null, bandOverride?: string | null) {
  const root = document.documentElement;
  let theme: string | null = themeOverride ?? null;
  let band: string | null = bandOverride ?? null;
  try {
    if (theme === null) theme = localStorage.getItem(themeKey);
    if (band === null) band = localStorage.getItem(bandKey);
  } catch {
    // Storage can be blocked (private mode, embedded); fall back to defaults.
  }
  if (theme !== "light" && theme !== "dark" && theme !== "contrast") theme = "system";
  let resolved = theme;
  if (theme === "system") {
    const media = (query: string) => Boolean(window.matchMedia && window.matchMedia(query).matches);
    resolved = media("(prefers-color-scheme: dark)") ? "dark" : media("(prefers-contrast: more)") ? "contrast" : "light";
  }
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-preference", theme);
  root.setAttribute("data-band", band === "elementary" || band === "high" ? band : "middle");
}

export const preferencesScript = `(${applyStoredPreferences.toString()})(${JSON.stringify(THEME_KEY)},${JSON.stringify(BAND_KEY)});`;

// --- Client store (used through the usePreferences hook) ---------------------------------

const listeners = new Set<() => void>();
let cached: Preferences = DEFAULT_PREFERENCES;

function emit() {
  for (const listener of listeners) listener();
}

// Choices that could not be saved (storage blocked, for example in some private modes) are kept
// here, so they still apply for the rest of the visit.
const unsaved: Record<string, string> = {};

// Browser UI colour (mobile address bar) per resolved theme: the canvas colour of each theme.
const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#f5f8ff", dark: "#0b1229", contrast: "#ffffff" };

/** The theme-color meta tags use OS media queries; point them all at the chosen theme instead. */
function syncThemeColor() {
  const resolved = (document.documentElement.dataset.theme as ResolvedTheme | undefined) ?? "light";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = THEME_COLORS[resolved];
  });
}

function apply() {
  applyStoredPreferences(THEME_KEY, BAND_KEY, unsaved[THEME_KEY], unsaved[BAND_KEY]);
  syncThemeColor();
  emit();
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    delete unsaved[key];
  } catch {
    unsaved[key] = value;
  }
}

export function getPreferences(): Preferences {
  const data = document.documentElement.dataset;
  const next: Preferences = {
    theme: (data.themePreference as ThemePreference | undefined) ?? "system",
    resolvedTheme: (data.theme as ResolvedTheme | undefined) ?? "light",
    band: (data.band as GradeBandId | undefined) ?? "middle",
  };
  // useSyncExternalStore needs a stable object while nothing changed.
  if (next.theme !== cached.theme || next.resolvedTheme !== cached.resolvedTheme || next.band !== cached.band) {
    cached = next;
  }
  return cached;
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    syncThemeColor();
    window.addEventListener("storage", onStorage);
    darkQuery().addEventListener("change", onSystemChange);
    contrastQuery().addEventListener("change", onSystemChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
      darkQuery().removeEventListener("change", onSystemChange);
      contrastQuery().removeEventListener("change", onSystemChange);
    }
  };
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const contrastQuery = () => window.matchMedia("(prefers-contrast: more)");

/** Another tab changed a preference. */
function onStorage(event: StorageEvent) {
  if (event.key === THEME_KEY || event.key === BAND_KEY) apply();
}

/** The OS switched dark mode or contrast; only matters while following the system. */
function onSystemChange() {
  if (document.documentElement.dataset.themePreference === "system") apply();
}

export function setThemePreference(theme: ThemePreference) {
  write(THEME_KEY, theme);
  apply();
}

export function setGradeBand(band: GradeBandId) {
  write(BAND_KEY, band);
  apply();
}
