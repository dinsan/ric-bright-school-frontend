import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CourseHome } from "@/features/learn/components/course-home";
import { requirePageAuth } from "@/server/auth/current-user";
import { getCourseBySlug } from "@/server/catalog/service";
import { courseQuizzes } from "@/server/learning/quizzes";
import { courseProgress } from "@/server/learning/service";

interface Props {
  params: Promise<{ slug: string }>;
}

const load = cache(async (slug: string) => {
  const auth = await requirePageAuth(["student"]);
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  const [progress, quizzes] = await Promise.all([courseProgress(auth, course.id), courseQuizzes(auth, course.id)]);
  return { course, progress, quizzes };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { course } = await load((await params).slug);
  return { title: course.title };
}

/** A course from the student's side: progress, start or continue, the outline, its quizzes, leave. */
export default async function StudentCoursePage({ params }: Props) {
  const { course, progress, quizzes } = await load((await params).slug);
  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <Breadcrumb items={[{ label: "My courses", href: "/learn/courses" }, { label: course.title }]} />
      <PageHeader title={course.title} />
      <CourseHome
        course={{ id: course.id, slug: course.slug, title: course.title, summary: course.summary, grade_level: course.grade_level, subject: course.subject }}
        initial={progress}
        quizzes={quizzes}
      />
    </div>
  );
}
