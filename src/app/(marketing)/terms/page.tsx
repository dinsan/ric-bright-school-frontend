import type { Metadata } from "next";
import { InShort, LegalPage } from "@/features/legal/components/legal-page";
import { termsInShort, termsSections } from "@/features/legal/content/terms";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms of use",
  description: "The agreement for using Lumina: who can have an account, keeping it safe, using Lumina well, and ending your account.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      document="terms"
      lead="The agreement between you and Lumina, in plain words."
      summary={<InShort points={termsInShort} />}
      sections={termsSections}
    />
  );
}
