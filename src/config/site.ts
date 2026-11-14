/**
 * Site-wide facts for the public pages, metadata and structured data.
 * `url` is the public address (SITE_URL at build time, see next.config.ts).
 */
const url = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const siteConfig = {
  name: "Lumina",
  url,
  /** False for previews, staging and builds that point at localhost: every page is noindex, robots.txt disallows all. */
  indexable: process.env.SITE_NOINDEX !== "true",
  /** Short, for the footer and the default meta description. */
  description: "Courses for Grades 1 to 12, organised by grade and subject.",
  /** Longer, for the home page and search results. */
  longDescription:
    "Lumina is a learning platform for Grades 1 to 12: courses by grade and subject, simple sign-in for young children, and accounts for parents and teachers. No ads, no tracking.",
  locale: "en",
  /**
   * Outside services, linked from the footer once they exist (FE-PUB-10). Set at build time:
   * SITE_STATUS_URL (the status page, e.g. a hosted status provider) and SITE_HELP_URL (the help
   * center). Unset, the links are simply not shown — no dead links.
   */
  statusPage: process.env.SITE_STATUS_URL || null,
  helpCenter: process.env.SITE_HELP_URL || null,
  nav: [
    { href: "/courses", label: "Courses" },
    // The phone header has no room for more links; Pricing stays reachable there through the footer.
    { href: "/pricing", label: "Pricing", desktopOnly: true },
  ],
  footer: [
    {
      heading: "Learn",
      links: [
        { href: "/courses", label: "All courses" },
        { href: "/pricing", label: "Pricing" },
        { href: "/sign-up", label: "Create an account" },
        { href: "/sign-in", label: "Sign in" },
      ],
    },
    {
      heading: "Trust",
      links: [
        { href: "/safety", label: "Keeping children safe" },
        { href: "/privacy", label: "Privacy policy" },
        { href: "/terms", label: "Terms of use" },
        { href: "/cookies", label: "Cookies" },
        { href: "/contact", label: "Contact us" },
      ],
    },
  ],
} as const;

/** An absolute URL on this site: absoluteUrl("/courses") -> https://lumina.example/courses. */
export function absoluteUrl(path = "/"): string {
  return path === "/" ? url : `${url}${path.startsWith("/") ? path : `/${path}`}`;
}
