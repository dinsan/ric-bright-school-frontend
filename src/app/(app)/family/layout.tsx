import type { ReactNode } from "react";
import { requireUser } from "@/server/auth/current-user";

// Only parents; anyone else is sent to their own home.
export default async function Layout({ children }: { children: ReactNode }) {
  await requireUser(["parent"]);
  return children;
}
