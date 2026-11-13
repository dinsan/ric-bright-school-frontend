import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Home" };

export default async function StudentHome() {
  const user = await requireUser(["student"]);
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title={`Hi, ${user.display_name.split(" ")[0]}!`} description={user.grade_level ? `Grade ${user.grade_level}` : undefined} />
      <EmptyState
        illustration="empty"
        title="Your courses will be here"
        description="Soon you will find your lessons and quizzes on this page. Until then, look around the courses for your grade."
        action={<ButtonLink href={user.grade_level ? `/courses?grade=${user.grade_level}` : "/courses"}>See courses</ButtonLink>}
      />
      <Card className="sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <CardTitle as="h2">Connect a parent</CardTitle>
          <CardDescription>Make a code so your parent can see how you are doing.</CardDescription>
        </div>
        <ButtonLink href="/account#connect-parent" variant="secondary">
          Make a code
        </ButtonLink>
      </Card>
    </div>
  );
}
