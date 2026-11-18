import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl } from "@/config/site";
import { GRADE_BANDS } from "@/features/catalog/constants";
import { CourseGrid } from "@/features/catalog/components/course-grid";
import type { Course, Subject } from "@/features/catalog/types";
import { pluralize } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { subjectWithCourses } from "@/server/catalog/service";

interface SubjectPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * /subjects/mathematics: one subject across every grade, grouped by grade band (FE-PUB-03). A main
 * organic entry point, like the grade pages. Rendered on first visit (builds don't need the database),
 * cached, refreshed at most every 5 minutes.
 */
export const revalidate = 300;
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

const loadSubject = cache(async (slug: string) => {
  const found = await subjectWithCourses(slug);
  if (!found) notFound();
  return found;
});

export async function generateMetadata({ params }: SubjectPageProps): Promise<Metadata> {
  const { subject, courses } = await loadSubject((await params).slug);
  const grades = courses.map((course) => course.grade_level);
  const range = grades.length ? ` for Grades ${Math.min(...grades)} to ${Math.max(...grades)}` : "";
  return pageMetadata({
    title: `${subject.name} courses`,
    description: subject.description ?? `${subject.name} courses${range}, each with its lessons and price.`,
    path: `/subjects/${subject.slug}`,
  });
}

function subjectJsonLd(subject: Subject, courses: Course[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl(`/subjects/${subject.slug}`),
    url: absoluteUrl(`/subjects/${subject.slug}`),
    name: `${subject.name} courses`,
    inLanguage: "en",
    about: { "@type": "Thing", name: subject.name },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: courses.map((course, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/courses/${course.slug}`),
        name: course.title,
      })),
    },
  };
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { subject, courses } = await loadSubject((await params).slug);
  const bands = GRADE_BANDS.map((band) => ({
    ...band,
    courses: courses.filter((course) => course.grade_level >= band.from && course.grade_level <= band.to),
  })).filter((band) => band.courses.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-gutter py-10 lg:py-14">
      <JsonLd data={subjectJsonLd(subject, courses)} />
      <Breadcrumb className="mb-6" items={[{ label: "Courses", href: "/courses" }, { label: subject.name }]} />

      <h1 className="text-title">{subject.name}</h1>
      <p className="mt-2 max-w-2xl text-fg-muted">
        {subject.description ?? `Every ${subject.name} course, from the first steps to the hardest grades.`} {pluralize(courses.length, "course")}.
      </p>

      {courses.length === 0 ? (
        <EmptyState
          className="mt-10"
          illustration="empty"
          title={`No ${subject.name} courses yet`}
          description="New courses are published all the time. Browse the other subjects meanwhile."
          action={<ButtonLink href="/courses">Browse all courses</ButtonLink>}
        />
      ) : (
        <div className="mt-10 grid gap-12">
          {bands.map((band) => (
            <section key={band.id} aria-labelledby={`band-${band.id}`}>
              <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 id={`band-${band.id}`} className="text-heading">
                  {band.label}
                </h2>
                <p className="text-small font-bold text-fg-muted">
                  Grades{" "}
                  {[...new Set(band.courses.map((course) => course.grade_level))].map((grade, index) => (
                    <span key={grade}>
                      {index > 0 && ", "}
                      <Link href={`/grades/${grade}`} className="underline underline-offset-4 hover:no-underline">
                        {grade}
                      </Link>
                    </span>
                  ))}
                </p>
              </div>
              <CourseGrid courses={band.courses} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
