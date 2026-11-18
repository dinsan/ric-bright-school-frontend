/**
 * Dates on the parent's pages, in the parent's time zone (UTC when unset or unknown). Pure, shared by the
 * server-rendered pages and the tests.
 */

function formatter(options: Intl.DateTimeFormatOptions, timeZone: string | null | undefined) {
  try {
    return new Intl.DateTimeFormat("en", { ...options, timeZone: timeZone ?? "UTC" });
  } catch {
    return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" });
  }
}

/** "Nov 16, 2026". A calendar day ("2026-11-16") is shown as that day, whatever the time zone. */
export function formatDay(value: string, timeZone?: string | null): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatter({ day: "numeric", month: "short", year: "numeric" }, "UTC").format(new Date(`${value}T00:00:00Z`));
  return formatter({ day: "numeric", month: "short", year: "numeric" }, timeZone).format(new Date(value));
}

/** "Mon, Nov 16, 16:05". */
export function formatDateTime(value: string, timeZone?: string | null): string {
  return formatter({ weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }, timeZone).format(new Date(value));
}

/** "Mon" and "16" for a chart axis, from a calendar day. */
export function dayParts(day: string): { weekday: string; date: string } {
  const date = new Date(`${day}T00:00:00Z`);
  return {
    weekday: formatter({ weekday: "short" }, "UTC").format(date),
    date: formatter({ day: "numeric", month: "short" }, "UTC").format(date),
  };
}

/** Short minutes for tiles: 0 → "0 min", 45 → "45 min", 95 → "1 h 35 min". */
export function shortMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}
