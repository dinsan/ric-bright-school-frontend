import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/config/site";

/** The site-wide share image (src/app/opengraph-image.tsx). */
const SITE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${siteConfig.name}: courses for Grades 1 to 12` };

/**
 * Metadata for a public page: title, description, canonical URL, and matching Open Graph / Twitter
 * cards. Next.js merges metadata shallowly: a page's `openGraph` replaces its parent's, including the
 * image inherited from src/app/opengraph-image.tsx, so the site image is named here. Segments with their
 * own `opengraph-image` file (course pages) pass `ownImage`: naming an image would override that file.
 */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  ownImage = false,
}: {
  /** Page title; the root layout adds " · Lumina". Omit for the home page. */
  title?: string;
  description: string;
  /** Canonical path, e.g. "/courses/fractions". */
  path: string;
  type?: "website" | "article";
  /** The page's segment has its own opengraph-image file. */
  ownImage?: boolean;
}): Metadata {
  const images = ownImage ? {} : { images: [SITE_IMAGE] };
  const fullTitle = title ? `${title} · ${siteConfig.name}` : `${siteConfig.name}: learn every grade`;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: siteConfig.name,
      locale: "en_GB",
      url: path,
      title: fullTitle,
      description,
      ...images,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, ...images },
  };
}

/**
 * JSON-LD as a string that is safe inside a <script> tag: `<` is escaped, so text from the database
 * (a course title containing "</script>") can't close the tag.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** schema.org: who runs the site. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": `${absoluteUrl("/")}#organization`,
    name: siteConfig.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.svg"),
    description: siteConfig.longDescription,
  };
}

/** schema.org: the site itself, with its search (/search?q=…). */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    name: siteConfig.name,
    url: absoluteUrl("/"),
    inLanguage: siteConfig.locale,
    publisher: { "@id": `${absoluteUrl("/")}#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}
