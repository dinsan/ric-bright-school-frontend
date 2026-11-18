"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Me } from "@/features/auth/contract";
import { usePreferences } from "@/hooks/use-preferences";
import { gradeBandForGrade, type GradeBandId } from "@/lib/preferences";
import { STORAGE_KEYS } from "@/lib/storage-keys";

/**
 * Who the student is, for every component under /learn (the app shell pages and the focused lesson
 * pages). The student area's layouts put it in place from the server session, so components never
 * wait for it and never see another role: `useStudent()` outside a student area is a bug and throws.
 */

export interface Student {
  id: string;
  displayName: string;
  /** First name, for greetings ("Hi, Maya!"). */
  firstName: string;
  gradeLevel: number | null;
  /** The presentation that fits the grade (Grades 1–5, 6–8, 9–12); the device's choice may differ. */
  gradeBand: GradeBandId;
  timezone: string | null;
}

const StudentContext = createContext<Student | null>(null);

export function toStudent(user: Me): Student {
  return {
    id: user.id,
    displayName: user.display_name,
    firstName: user.display_name.split(" ")[0] ?? user.display_name,
    gradeLevel: user.grade_level ?? null,
    gradeBand: gradeBandForGrade(user.grade_level ?? 6),
    timezone: user.timezone ?? null,
  };
}

/**
 * Provides the student to the tree. With `applyGradeBand`, a device that never chose a reading level
 * gets the one for the student's grade (a choice made in Display settings is respected).
 */
export function StudentProvider({ user, applyGradeBand = true, children }: { user: Me; applyGradeBand?: boolean; children: ReactNode }) {
  if (user.role !== "student") throw new Error(`StudentProvider is for students, got a ${user.role}.`);
  const student = toStudent(user);
  const { band, setGradeBand } = usePreferences();
  useEffect(() => {
    if (!applyGradeBand || !user.grade_level) return;
    let chosen: string | null = null;
    try {
      chosen = window.localStorage.getItem(STORAGE_KEYS.band);
    } catch {
      // storage blocked: treat as not chosen
    }
    if (chosen === null && band !== student.gradeBand) setGradeBand(student.gradeBand);
  }, [applyGradeBand, band, setGradeBand, student.gradeBand, user.grade_level]);
  return <StudentContext.Provider value={student}>{children}</StudentContext.Provider>;
}

/** The signed-in student. Only inside the student area (under StudentProvider). */
export function useStudent(): Student {
  const student = useContext(StudentContext);
  if (!student) throw new Error("useStudent() is only available in the student area (wrap the tree in <StudentProvider>).");
  return student;
}
