import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const user = await requireUser(["admin"]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Hi, ${user.display_name.split(" ")[0]}`} description="Lumina administration." />
      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Card asChild interactive className="h-full">
            <Link href="/admin/users">
              <Users aria-hidden className="size-8" />
              <CardTitle as="h2">Users</CardTitle>
              <CardDescription>Find people, change roles, verify teachers, reset two-step verification, view as a user for support.</CardDescription>
            </Link>
          </Card>
        </li>
      </ul>
    </div>
  );
}
