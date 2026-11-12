"use client";

import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { usePreferences } from "@/hooks/use-preferences";
import { GRADE_BAND_IDS, THEME_PREFERENCES, type GradeBandId, type ThemePreference } from "@/lib/preferences";
import { themeOptions } from "./theme-switcher";

export const gradeBandOptions: Record<GradeBandId, { label: string; description: string }> = {
  elementary: { label: "Grades 1 to 5", description: "Bigger words and buttons, more colour and pictures." },
  middle: { label: "Grades 6 to 8", description: "The standard look." },
  high: { label: "Grades 9 to 12", description: "More on screen, calmer colours." },
};

/** Theme choice as radio buttons. Applies and is remembered immediately. */
export function ThemeSettings() {
  const { theme, setTheme } = usePreferences();
  return (
    <RadioGroup legend="Theme" hint="Changes apply straight away.">
      {THEME_PREFERENCES.map((value) => (
        <Radio
          key={value}
          name="theme"
          value={value}
          label={themeOptions[value].label}
          checked={theme === value}
          onChange={() => setTheme(value as ThemePreference)}
        />
      ))}
    </RadioGroup>
  );
}

/**
 * The single grade-band switch (age-appropriate presentation). Until accounts exist it is a
 * local setting; afterwards the student profile drives it.
 */
export function GradeBandSettings() {
  const { band, setGradeBand } = usePreferences();
  return (
    <RadioGroup legend="Reading level" hint="Sets text size, button size and how busy screens look.">
      {GRADE_BAND_IDS.map((value) => (
        <Radio
          key={value}
          name="grade-band"
          value={value}
          label={gradeBandOptions[value].label}
          description={gradeBandOptions[value].description}
          checked={band === value}
          onChange={() => setGradeBand(value)}
        />
      ))}
    </RadioGroup>
  );
}
