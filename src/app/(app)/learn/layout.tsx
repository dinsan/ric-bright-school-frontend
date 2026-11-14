import type { ReactNode } from "react";
import { StudentArea } from "@/features/learn/student-area";
import { requireUser } from "@/server/auth/current-user";

/**
 * The student area inside the app shell (sidebar, top bar): /learn and its pages. Only students;
 * anyone else is sent to their own home. `useStudent()`, `useProgressSync()` and the celebrations work in everything below.
 * Lessons and quizzes live in the focused shell instead: src/app/(focus)/learn.
 */
export default async function Layout({ children }: { children: ReactNode }) {
  const user = await requireUser(["student"]);
  return <StudentArea user={user}>{children}</StudentArea>;
}
