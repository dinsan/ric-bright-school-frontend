import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function TeacherHome() {
  const user = await requireUser(["teacher"]);
  const profile = user.teacher_profile;
  const complete = Boolean(profile?.school_name && profile.subjects.length && profile.grade_levels.length);
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title={`Hi, ${user.display_name.split(" ")[0]}`} />
      {profile?.verified ? (
        <Alert tone="success" title="Your teacher account is verified" />
      ) : (
        <Alert
          tone="info"
          title="We are checking your teacher account"
          action={!complete && <ButtonLink href="/account#teacher-profile" size="sm" variant="secondary">Complete your profile</ButtonLink>}
        >
          {complete
            ? "Thanks for completing your profile. A Lumina admin will verify you soon."
            : "Add your school, subjects and grades so an admin can verify you."}
        </Alert>
      )}
      {!user.mfa_enabled && (
        <Card className="sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <CardTitle as="h2">Protect your account</CardTitle>
            <CardDescription>Teachers see children&apos;s work. Turn on two-step verification.</CardDescription>
          </div>
          <ButtonLink href="/account/security#two-step" variant="secondary">
            Turn it on
          </ButtonLink>
        </Card>
      )}
      <EmptyState illustration="empty" title="Classes are coming" description="Soon you will create classes, share a class code and set work here." />
    </div>
  );
}
