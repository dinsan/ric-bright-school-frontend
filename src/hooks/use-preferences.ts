"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  setGradeBand,
  setThemePreference,
  subscribePreferences,
} from "@/lib/preferences";

/**
 * Current theme and grade band, and setters. The server (and the first client render) sees the
 * defaults; React then switches to the real values without a hydration mismatch.
 */
export function usePreferences() {
  const preferences = useSyncExternalStore(subscribePreferences, getPreferences, () => DEFAULT_PREFERENCES);
  return { ...preferences, setTheme: setThemePreference, setGradeBand };
}
