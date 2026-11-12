import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
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
      <SignUpForm />
    </AuthCard>
  );
}
