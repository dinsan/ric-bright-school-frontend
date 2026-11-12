import type { ReactNode } from "react";
import { requireUser } from "@/lib/server/session";

// Only admins; anyone else is sent to their own home.
export default async function Layout({ children }: { children: ReactNode }) {
  await requireUser(["admin"]);
  return children;
}
