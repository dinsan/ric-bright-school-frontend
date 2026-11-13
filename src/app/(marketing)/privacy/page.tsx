import type { Metadata } from "next";
import { KidsSummary } from "@/features/legal/components/kids-summary";
import { InShort, LegalPage } from "@/features/legal/components/legal-page";
import { privacyInShort, privacyKidsPoints, privacySections } from "@/features/legal/content/privacy";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description: "What Lumina collects about children, parents and teachers, why, for how long, and your rights. With a short version for kids.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      document="privacy"
      lead="What we keep about you and your children, why, for how long, and what you can ask us to do with it."
      summary={
        <div className="grid gap-6">
          <KidsSummary points={privacyKidsPoints} />
          <InShort points={privacyInShort} />
        </div>
      }
      sections={privacySections}
    />
  );
}
