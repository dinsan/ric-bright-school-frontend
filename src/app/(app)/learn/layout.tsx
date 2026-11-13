import type { ReactNode } from "react";
import { requireUser } from "@/server/auth/current-user";

// Only students; anyone else is sent to their own home.
export default async function Layout({ children }: { children: ReactNode }) {
  await requireUser(["student"]);
  return children;
}
