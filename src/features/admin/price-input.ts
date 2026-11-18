import { MAX_PRICE_CENTS } from "@/features/catalog/constants";

/** The price editor's reading and writing of amounts. Pure: no DOM, no React (testable anywhere). */

/** Cents to a dollars string for the input: 1250 → "12.50", 900 → "9", 0 → "0". */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** A dollars string from the input to cents, or null when it isn't a price (0 to $999.99). */
export function inputToCents(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, "");
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  return cents > MAX_PRICE_CENTS ? null : cents;
}
