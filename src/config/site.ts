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
  nav: [{ href: "/courses", label: "Courses" }],
  footer: [
    {
      heading: "Learn",
      links: [
        { href: "/courses", label: "All courses" },
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
