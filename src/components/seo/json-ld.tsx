import { jsonLdString } from "@/lib/seo";

/** Structured data for search engines (schema.org), rendered in the page as Next.js recommends. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
