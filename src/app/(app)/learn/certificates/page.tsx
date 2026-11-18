import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AchievementsNav } from "@/features/learn/components/achievements-nav";
import { CertificatesList } from "@/features/learn/components/certificates-list";

export const metadata: Metadata = { title: "Certificates" };

export default function CertificatesPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="Certificates" description="One for every course you finish. Preview them, download them as PDF, print them." />
      <AchievementsNav />
      <CertificatesList />
    </div>
  );
}
