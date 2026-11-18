/**
 * Times in messages, in the reader's own clock: "14:05" today, "Yesterday, 14:05", "Mon 16 Nov, 14:05",
 * with the year when it isn't this year. Pure (takes `now`), so it's testable.
 */
export function formatWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days === 0) return time;
  if (days === 1) return `Yesterday, ${time}`;
  const options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) };
  return `${new Intl.DateTimeFormat("en", options).format(date)}, ${time}`;
}

/** The heading of a day in a conversation: "Today", "Yesterday", "Monday, Nov 16". */
export function dayHeading(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "short", ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) };
  return new Intl.DateTimeFormat("en", options).format(date);
}
