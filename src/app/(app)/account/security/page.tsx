import type { Metadata } from "next";
import {
  EmailSection,
  LinkedAccountsSection,
  MfaSection,
  PasswordSection,
  SessionsSection,
} from "@/features/account/components/security-sections";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Sign-in and security" };

type Props = { searchParams: Promise<{ link?: string; provider?: string }> };

export default async function SecurityPage({ searchParams }: Props) {
  const user = await requireUser();
  const { link, provider } = await searchParams;
  const adult = user.role !== "student";
  return (
    <>
      <PasswordSection />
      {user.email && <EmailSection user={user} />}
      {adult && <MfaSection user={user} />}
      {adult && <LinkedAccountsSection linkResult={{ status: link ?? null, provider: provider ?? null }} />}
      <SessionsSection />
    </>
  );
}
