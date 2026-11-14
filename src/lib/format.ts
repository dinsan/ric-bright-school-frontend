export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** One currency for the whole catalog; prices are stored in cents on each course. */
export const COURSE_CURRENCY = "USD";

const priceFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: COURSE_CURRENCY });

/** A course price in cents as people read it: 0 → "Free", 1250 → "$12.50". */
export function formatPrice(cents: number): string {
  return cents === 0 ? "Free" : priceFormatter.format(cents / 100);
}
