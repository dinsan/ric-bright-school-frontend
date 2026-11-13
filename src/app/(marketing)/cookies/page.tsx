import type { Metadata } from "next";
import { InShort, LegalPage } from "@/features/legal/components/legal-page";
import { cookiesSections, cookiesSummary } from "@/features/legal/content/cookies";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Cookies and device storage",
  description: "Every cookie and piece of device storage Lumina uses, what it does and how long it lasts. No advertising or tracking cookies.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalPage
      document="cookies"
      lead="Exactly what Lumina stores in your browser, and why."
      summary={<InShort points={cookiesSummary} />}
      sections={cookiesSections}
    />
  );
}
