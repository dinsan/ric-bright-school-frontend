import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPassword } from "@/features/auth/components/token-pages";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Choose a new password">
      <ResetPassword token={token ?? null} />
    </AuthCard>
  );
}
