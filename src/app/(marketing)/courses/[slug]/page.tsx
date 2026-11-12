import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getCourseBySlug } from "@/features/catalog/api";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { courseDetailLayout as layout } from "@/features/catalog/components/course-detail-layout";
import { GradeMark } from "@/features/catalog/components/grade-tile";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

interface CoursePageProps {
  params: Promise<{ slug: string }>;
}

// Deduplicated per request, so generateMetadata and the page share one API call.
const loadCourse = cache(async (slug: string) => {
  try {
    return await getCourseBySlug(slug, { next: { revalidate: 60 } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await loadCourse(slug);
  return { title: course.title, description: course.summary };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = await loadCourse(slug);

  return (
    <article className={layout.page}>
      <Breadcrumb
        className={layout.breadcrumb}
        items={[
          { label: "Courses", href: "/courses" },
          { label: `Grade ${course.grade_level}`, href: `/courses?grade=${course.grade_level}` },
          { label: course.title },
        ]}
      />

      <div className={layout.columns}>
        <div>
          <GradeMark grade={course.grade_level} className={layout.gradeMark} />
          <h1 className={layout.title}>{course.title}</h1>
          <p className={layout.summary}>{course.summary}</p>
          <div className="mt-8 max-w-2xl whitespace-pre-line">
            {course.description ?? "The full course outline has not been published yet."}
          </div>
        </div>

        <Card asChild className={layout.aside}>
          <aside aria-label="Course facts">
            <dl className={layout.facts}>
              <div>
                <dt className="font-bold text-fg-muted">Subject</dt>
                <dd className="mt-0.5 text-body font-extrabold">{course.subject.name}</dd>
              </div>
              <div>
                <dt className="font-bold text-fg-muted">Grade</dt>
                <dd className="mt-0.5 text-body font-extrabold">{course.grade_level}</dd>
              </div>
              {course.published_at && (
                <div>
                  <dt className="font-bold text-fg-muted">Published</dt>
                  <dd className="mt-0.5 text-body font-extrabold">{formatDate(course.published_at)}</dd>
                </div>
              )}
            </dl>
          </aside>
        </Card>
      </div>
    </article>
  );
}
