import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { QuizPlayer } from "@/features/learn/components/quiz-player";
import { requirePageAuth } from "@/server/auth/current-user";
import { HttpError } from "@/server/http/errors";
import { findQuizId, quizView } from "@/server/learning/quizzes";

interface QuizPageProps {
  params: Promise<{ slug: string; quiz: string }>;
}

/** The quiz player's data, read on the server (no HTTP hop) and shared by the metadata and the page. */
const load = cache(async (courseSlug: string, quizSlug: string) => {
  const auth = await requirePageAuth(["student"]);
  const quizId = await findQuizId(courseSlug, quizSlug);
  if (!quizId) notFound();
  try {
    return await quizView(auth, quizId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: QuizPageProps): Promise<Metadata> {
  const { slug, quiz } = await params;
  const view = await load(slug, quiz);
  return { title: `${view.quiz.title} · ${view.course.title}` };
}

/**
 * /learn/courses/{course}/quizzes/{quiz}: the quiz player (FE-ASM-01, FE-ASM-02), in the focused layout
 * (no app shell; students only, see the layout). Rendered with the data on the server; answers are saved
 * as the student goes and marked on the server when they finish.
 */
export default async function QuizPage({ params }: QuizPageProps) {
  const { slug, quiz } = await params;
  const view = await load(slug, quiz);
  return <QuizPlayer initial={view} exitHref={`/learn/courses/${view.course.slug}`} />;
}
