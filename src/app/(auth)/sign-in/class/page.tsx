import type { Metadata } from "next";
import { AuthLink } from "@/features/auth/components/auth-card";
import { ClassSignIn } from "@/features/auth/components/class-sign-in";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Class sign in" };

export default async function ClassSignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div data-band="elementary" className="grid gap-6">
      <h1 className="sr-only">Class sign in</h1>
      <Card>
        <ClassSignIn next={next} />
      </Card>
      <p className="text-center text-small">
        <AuthLink href="/sign-in/student">Sign in with a username</AuthLink>
      </p>
    </div>
  );
}
