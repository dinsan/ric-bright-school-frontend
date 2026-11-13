import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { AuthCard, AuthLink } from "@/features/auth/components/auth-card";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string; error?: string; step?: string }> };

/** Why Google / Microsoft / Apple sign-in came back here (see src/server/oauth/service.ts). */
const oauthErrors: Record<string, { title: string; body: string }> = {
  oauth: {
    title: "That didn't work",
    body: "We couldn't sign you in with that account. Try again, or use your email and password.",
  },
  oauth_no_account: {
    title: "No Lumina account uses that sign-in yet",
    body: "Create an account first (you can use the same button on the sign-up page), or sign in with your email and link it in Sign-in and security.",
  },
  oauth_email_taken: {
    title: "You already have an account with this email",
    body: "Sign in with your email and password, then link it in Sign-in and security to use it next time.",
  },
  oauth_email_unverified: {
    title: "We couldn't confirm that email address",
    body: "That account didn't confirm its email address to us. Sign up with your email and a password instead.",
  },
  account_disabled: {
    title: "This account is turned off",
    body: "Ask your school or contact Lumina support.",
  },
};

export default async function SignInPage({ searchParams }: Props) {
  const { next, error, step } = await searchParams;
  const problem = error ? (oauthErrors[error] ?? oauthErrors.oauth) : null;
  return (
    <AuthCard
      title="Sign in"
      description="For parents, teachers and school staff."
      footer={
        <>
          <p>
            Student? <AuthLink href={withNext("/sign-in/student", next)}>Sign in with your username</AuthLink>
          </p>
          <p>
            On a classroom device? <AuthLink href={withNext("/sign-in/class", next)}>Use a class code</AuthLink>
          </p>
          <p>
            New to Lumina? <AuthLink href="/sign-up">Create an account</AuthLink>
          </p>
        </>
      }
    >
      {problem && (
        <Alert tone="danger" title={problem.title}>
          {problem.body}
        </Alert>
      )}
      <SignInForm next={next} initialStep={step === "mfa" ? "mfa" : "credentials"} />
    </AuthCard>
  );
}

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
