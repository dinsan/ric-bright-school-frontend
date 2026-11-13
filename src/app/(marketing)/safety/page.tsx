import type { Metadata } from "next";
import { KidsSummary } from "@/features/legal/components/kids-summary";
import { LegalPage } from "@/features/legal/components/legal-page";
import { safetyKidsPoints, safetySections } from "@/features/legal/content/safety";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Keeping children safe",
  description: "How Lumina is built to keep children safe: no chat, no ads, simple sign-in, checked teachers. Tips for families and teachers, and how to report a concern.",
  path: "/safety",
});

export default function SafetyPage() {
  return (
    <LegalPage
      document="safety"
      lead="How Lumina is built to protect children, tips for families and teachers, and how to tell us about a concern."
      summary={<KidsSummary title="Staying safe online, for kids" points={safetyKidsPoints} />}
      sections={safetySections}
    />
  );
}
