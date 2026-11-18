import type { ReactNode } from "react";
import { LearningControlsGate } from "@/features/learn/components/learning-controls";
import { StudentArea } from "@/features/learn/student-area";
import { requirePageAuth, requireUser } from "@/server/auth/current-user";
import { studentControls } from "@/server/family/controls";

/**
 * The student's focused pages (lessons, review sessions, quizzes). Only students; `useStudent()`, `useProgressSync()` and the celebrations work below.
 * A parent's learning-time limit or bedtime (FE-PAR-03) shows a reminder here, or a break screen instead of the page.
 */
export default async function Layout({ children }: { children: ReactNode }) {
  const user = await requireUser(["student"]);
  const controls = await studentControls(await requirePageAuth(["student"]));
  return (
    <StudentArea user={user}>
      <LearningControlsGate initial={controls}>{children}</LearningControlsGate>
    </StudentArea>
  );
}
