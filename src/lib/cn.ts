import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom scales from globals.css (@theme) so it knows which classes
// conflict. Without this, `text-body` would be mistaken for a colour (and `cn("text-fg",
// "text-body")` would drop `text-fg`), and `shadow-sticker` for a shadow colour.
// Keep in sync with the type scale, spacing, radius, shadow and z-index tokens.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "small", "body", "control", "lead", "heading", "title", "display"],
      spacing: ["control", "control-sm", "control-lg", "control-x", "check", "icon", "card", "stack", "gutter"],
      radius: ["control", "card"],
      shadow: ["sticker", "sticker-lg"],
    },
    classGroups: {
      z: [{ z: ["raised", "sticky", "overlay", "modal", "popover", "toast", "tooltip", "skip"] }],
      duration: [{ duration: ["fast", "base", "slow"] }],
    },
  },
});

/** Joins class names (clsx syntax) and lets later Tailwind classes override earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
