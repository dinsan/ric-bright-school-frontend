"use client";

import type { ReactNode } from "react";
import type { Me } from "@/features/auth/contract";
import { CelebrationCenter } from "./components/celebration";
import { StudentProvider } from "./student-context";
import { ProgressSyncProvider } from "./sync/progress-sync";

/**
 * Everything a student page needs around it, in one place for both student layouts ((app)/learn and
 * (focus)/learn): who the student is (useStudent), the offline-safe progress queue (useProgressSync),
 * and the celebrations for what progress earns.
 */
export function StudentArea({ user, children }: { user: Me; children: ReactNode }) {
  return (
    <StudentProvider user={user}>
      <ProgressSyncProvider studentId={user.id}>
        {children}
        <CelebrationCenter />
      </ProgressSyncProvider>
    </StudentProvider>
  );
}
