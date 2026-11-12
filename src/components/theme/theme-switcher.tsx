"use client";

import { Contrast, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePreferences } from "@/hooks/use-preferences";
import { THEME_PREFERENCES, type ResolvedTheme, type ThemePreference } from "@/lib/preferences";

export const themeOptions: Record<ThemePreference, { label: string; icon: LucideIcon }> = {
  system: { label: "Match my device", icon: Monitor },
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  contrast: { label: "High contrast", icon: Contrast },
};

const resolvedIcons: Record<ResolvedTheme, LucideIcon> = { light: Sun, dark: Moon, contrast: Contrast };

/** Compact theme menu for headers. */
export function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = usePreferences();
  const Icon = resolvedIcons[resolvedTheme];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Theme: ${themeOptions[theme].label}. Change theme`}>
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
          {THEME_PREFERENCES.map((value) => {
            const { label, icon: OptionIcon } = themeOptions[value];
            return (
              <DropdownMenuRadioItem key={value} value={value}>
                <OptionIcon aria-hidden />
                {label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
