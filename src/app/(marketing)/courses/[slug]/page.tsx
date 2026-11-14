import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { courseDetailLayout as layout } from "@/features/catalog/components/course-detail-layout";
import { CourseOutline, totalMinutes } from "@/features/catalog/components/course-outline";
import { GradeMark } from "@/features/catalog/components/grade-tile";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, siteConfig } from "@/config/site";
import type { Course } from "@/features/catalog/types";
import { COURSE_CURRENCY, formatDate, formatPrice } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { courseLessons, getCourseBySlug, relatedCourses } from "@/server/catalog/service";
import { CourseGrid } from "@/features/catalog/components/course-grid";
import { StartLearning } from "@/features/learn/components/start-learning";

interface CoursePageProps {
  params: Promise<{ slug: string }>;
}

// Incremental static regeneration: each course page is rendered on its first visit (nothing at build
// time, so builds don't need the database), served from the cache, and re-rendered at most once a minute.
export const revalidate = 60;
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

// Read straight from the database (no HTTP hop); deduplicated per render, so generateMetadata and the
// page share one query.
const loadCourse = cache(async (slug: string) => {
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  return course;
});

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await loadCourse(slug);
  return pageMetadata({
    title: `${course.title} (Grade ${course.grade_level} ${course.subject.name})`,
    description: course.summary,
    path: `/courses/${course.slug}`,
    ownImage: true,
  });
}

/** schema.org Course: what search engines show about a course. */
function courseJsonLd(course: Course) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": absoluteUrl(`/courses/${course.slug}`),
    url: absoluteUrl(`/courses/${course.slug}`),
    name: course.title,
    description: course.summary,
    inLanguage: "en",
    educationalLevel: `Grade ${course.grade_level}`,
    about: { "@type": "Thing", name: course.subject.name },
    provider: { "@type": "EducationalOrganization", name: siteConfig.name, url: absoluteUrl("/") },
    isAccessibleForFree: course.price_cents === 0,
    offers: {
      "@type": "Offer",
      price: (course.price_cents / 100).toFixed(2),
      priceCurrency: COURSE_CURRENCY,
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/courses/${course.slug}`),
      category: course.price_cents === 0 ? "Free" : "Paid",
    },
    ...(course.published_at ? { datePublished: course.published_at } : {}),
    dateModified: course.updated_at,
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = await loadCourse(slug);
  const [lessons, related] = await Promise.all([courseLessons(course.id), relatedCourses(course)]);
  const minutes = totalMinutes(lessons);

  return (
    <article className={layout.page}>
      <JsonLd data={courseJsonLd(course)} />
      <Breadcrumb
        className={layout.breadcrumb}
        items={[
          { label: "Courses", href: "/courses" },
          { label: `Grade ${course.grade_level}`, href: `/grades/${course.grade_level}` },
          { label: course.title },
        ]}
      />

      <div className={layout.columns}>
        <div>
          <GradeMark grade={course.grade_level} className={layout.gradeMark} />
          <h1 className={layout.title}>{course.title}</h1>
          <p className={layout.summary}>{course.summary}</p>
          {course.description && <div className="mt-8 max-w-2xl whitespace-pre-line">{course.description}</div>}
          {lessons.length > 0 ? (
            <CourseOutline lessons={lessons} />
          ) : (
            !course.description && <p className="mt-8 max-w-2xl">The full course outline has not been published yet.</p>
          )}
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
              <div>
                <dt className="font-bold text-fg-muted">Price</dt>
                <dd className="mt-0.5 text-body font-extrabold">{formatPrice(course.price_cents)}</dd>
              </div>
              {lessons.length > 0 && (
                <div>
                  <dt className="font-bold text-fg-muted">Length</dt>
                  <dd className="mt-0.5 text-body font-extrabold">
                    {lessons.length} lessons{minutes > 0 && `, about ${minutes} min`}
                  </dd>
                </div>
              )}
              {course.published_at && (
                <div>
                  <dt className="font-bold text-fg-muted">Published</dt>
                  <dd className="mt-0.5 text-body font-extrabold">{formatDate(course.published_at)}</dd>
                </div>
              )}
            </dl>
            <StartLearning courseSlug={course.slug} />
          </aside>
        </Card>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-courses" className="mt-14">
          <h2 id="related-courses" className="mb-5 text-heading">
            Related courses
          </h2>
          <CourseGrid courses={related} />
        </section>
      )}
    </article>
  );
}
