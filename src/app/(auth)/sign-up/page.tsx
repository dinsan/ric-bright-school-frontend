import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

type Props = { searchParams: Promise<{ role?: string }> };

/** `?role=parent` or `?role=teacher` (from the home page) chooses the account type in advance. */
export default async function SignUpPage({ searchParams }: Props) {
  const { role } = await searchParams;
  return (
    <AuthCard
      title="Create an account"
      description="Parents and teachers sign up here. Students get their account from a parent or teacher."
      footer={
        <p>
          Already have an account? <AuthLink href="/sign-in">Sign in</AuthLink>
        </p>
      }
    >
      <SignUpForm initialRole={role === "parent" || role === "teacher" ? role : undefined} />
    </AuthCard>
  );
}
