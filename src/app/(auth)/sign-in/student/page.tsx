import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/features/auth/components/auth-card";
import { StudentSignInForm } from "@/features/auth/components/student-sign-in-form";

export const metadata: Metadata = { title: "Student sign in" };

export default async function StudentSignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Student sign in"
      description="Use the username and password your parent or teacher gave you."
      footer={
        <>
          <p>
            Do you use pictures? <AuthLink href="/sign-in/class">Sign in with a class code</AuthLink>
          </p>
          <p>
            Forgot your password? Ask your parent or teacher to reset it.
          </p>
          <p>
            <AuthLink href="/sign-in">Parent or teacher sign in</AuthLink>
          </p>
        </>
      }
    >
      <StudentSignInForm next={next} />
    </AuthCard>
  );
}
