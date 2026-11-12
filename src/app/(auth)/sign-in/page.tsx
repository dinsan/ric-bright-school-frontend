import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { AuthCard, AuthLink } from "@/features/auth/components/auth-card";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
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
      {error === "oauth" && (
        <Alert tone="danger" title="That didn't work">
          We couldn&apos;t sign you in with that account. Try again, or use your email and password.
        </Alert>
      )}
      <SignInForm next={next} />
    </AuthCard>
  );
}

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
