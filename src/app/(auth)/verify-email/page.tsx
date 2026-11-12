import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { VerifyEmail } from "@/features/auth/components/token-pages";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Confirm your email">
      <VerifyEmail token={token ?? null} />
    </AuthCard>
  );
}
