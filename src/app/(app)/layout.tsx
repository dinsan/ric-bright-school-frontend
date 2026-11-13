import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SignedInApp } from "@/features/auth/components/signed-in-app";
import { isImpersonating, requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { robots: { index: false } };

// Signed-in area. The proxy already sends signed-out visitors to sign-in (remembering the page);
// this layout checks the session in the database on every request.
export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <SignedInApp initialUser={user} impersonating={await isImpersonating()}>
      {children}
    </SignedInApp>
  );
}
