import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { LessonPlayer } from "@/features/learn/components/lesson-player";
import { requirePageAuth } from "@/server/auth/current-user";
import { HttpError } from "@/server/http/errors";
import { findLessonId, lessonView } from "@/server/learning/service";

interface LessonPageProps {
  params: Promise<{ slug: string; lesson: string }>;
  /** ?t=42: open the video of the part in the URL's #block-… at 42 s (a bookmarked moment). */
  searchParams: Promise<{ t?: string }>;
}

/** The lesson player's data, read on the server (no HTTP hop) and shared by the metadata and the page. */
const load = cache(async (courseSlug: string, lessonSlug: string) => {
  const auth = await requirePageAuth(["student"]);
  const lessonId = await findLessonId(courseSlug, lessonSlug);
  if (!lessonId) notFound();
  try {
    return await lessonView(auth, lessonId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { slug, lesson } = await params;
  const view = await load(slug, lesson);
  return { title: `${view.lesson.title} · ${view.course.title}` };
}

/**
 * /learn/courses/{course}/lessons/{lesson}: the lesson player (FE-STU-03), in the focused layout (no app
 * shell; students only, see the layout). Rendered with the data on the server, then kept fresh in the
 * browser; progress goes through the offline-safe queue.
 */
export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const { slug, lesson } = await params;
  const view = await load(slug, lesson);
  const t = Number((await searchParams).t);
  return <LessonPlayer initial={view} exitHref={`/learn/courses/${view.course.slug}`} startSeconds={Number.isFinite(t) && t >= 0 ? Math.floor(t) : null} />;
}
