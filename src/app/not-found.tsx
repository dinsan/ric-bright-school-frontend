import { PageNotFound } from "@/components/feedback/page-not-found";
import { MarketingShell } from "@/components/layout/marketing-shell";

// Unknown URLs. Rendered by the root layout only, so it brings the public header and footer itself.
export default function NotFound() {
  return (
    <MarketingShell>
      <PageNotFound />
    </MarketingShell>
  );
}
