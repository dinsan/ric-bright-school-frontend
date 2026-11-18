import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Focused pages (lessons and quizzes): no sidebar, no top bar, nothing but the task (FocusShell).
 * A separate route group from (app), so they don't inherit the app shell. Each section below adds its
 * own role guard; the proxy already sends signed-out visitors to sign-in (src/proxy.ts).
 */
export default function FocusLayout({ children }: { children: ReactNode }) {
  return children;
}
