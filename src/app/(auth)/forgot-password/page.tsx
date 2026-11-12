import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/features/auth/components/auth-card";
import { ForgotPassword } from "@/features/auth/components/token-pages";

export const metadata: Metadata = { title: "Forgot your password?" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter the email address you sign in with. We'll send a link to choose a new password."
      footer={
        <p>
          Remembered it? <AuthLink href="/sign-in">Sign in</AuthLink>
        </p>
      }
    >
      <ForgotPassword />
    </AuthCard>
  );
}
