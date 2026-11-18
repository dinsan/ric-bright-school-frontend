import type { Metadata } from "next";
import { PracticeSession } from "@/features/learn/components/practice-session";

export const metadata: Metadata = { title: "Review" };

interface Props {
  searchParams: Promise<{ mode?: string; course?: string }>;
}

/**
 * /learn/review/session?mode=review|practice&course={course id}: a review or practice session in the
 * focused shell (students only, see the layout).
 */
export default async function ReviewSessionPage({ searchParams }: Props) {
  const { mode, course } = await searchParams;
  const courseId = course && /^[0-9a-f-]{36}$/i.test(course) ? course : undefined;
  // A new session per visit: the key resets the component when the URL changes.
  return <PracticeSession key={`${mode}-${courseId}`} mode={mode === "practice" ? "practice" : "review"} courseId={courseId} />;
}
