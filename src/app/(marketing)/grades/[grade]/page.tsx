import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl } from "@/config/site";
import { GRADES, bandForGrade } from "@/features/catalog/constants";
import { CourseGrid } from "@/features/catalog/components/course-grid";
import { GradeMark } from "@/features/catalog/components/grade-tile";
import type { Course } from "@/features/catalog/types";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { gradeCourses } from "@/server/catalog/service";

interface GradePageProps {
  params: Promise<{ grade: string }>;
}

/**
 * /grades/4: everything Lumina has for one grade, grouped by subject (FE-PUB-03). A main organic entry
 * point: a parent searches "grade 4 online courses" and lands here. Rendered on first visit (builds
 * don't need the database), cached, refreshed at most every 5 minutes.
 */
export const revalidate = 300;
export function generateStaticParams(): Array<{ grade: string }> {
  return [];
}

/** The twelve grades exist even before any of them has courses; anything else is not a page. */
function parseGrade(value: string): number {
  const grade = Number(value);
  if (!/^\d{1,2}$/.test(value) || !GRADES.includes(grade)) notFound();
  return grade;
}

const loadCourses = cache(gradeCourses);

export async function generateMetadata({ params }: GradePageProps): Promise<Metadata> {
  const grade = parseGrade((await params).grade);
  const band = bandForGrade(grade);
  return pageMetadata({
    title: `Grade ${grade} courses`,
    description: `Online courses for Grade ${grade} (${band.label.toLowerCase()}): mathematics, reading and writing, science and more, each with its lessons and price.`,
    path: `/grades/${grade}`,
  });
}

function gradeJsonLd(grade: number, courses: Course[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl(`/grades/${grade}`),
    url: absoluteUrl(`/grades/${grade}`),
    name: `Grade ${grade} courses`,
    inLanguage: "en",
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

export default async function GradePage({ params }: GradePageProps) {
  const grade = parseGrade((await params).grade);
  const band = bandForGrade(grade);
  const courses = await loadCourses(grade);

  // Group by subject, keeping the service's subject-name order.
  const subjects = new Map<string, { name: string; slug: string; courses: Course[] }>();
  for (const course of courses) {
    const group = subjects.get(course.subject.slug) ?? { name: course.subject.name, slug: course.subject.slug, courses: [] };
    group.courses.push(course);
    subjects.set(course.subject.slug, group);
  }

  return (
    <div className="mx-auto max-w-6xl px-gutter py-10 lg:py-14">
      <JsonLd data={gradeJsonLd(grade, courses)} />
      <Breadcrumb className="mb-6" items={[{ label: "Courses", href: "/courses" }, { label: `Grade ${grade}` }]} />

      <div className="flex flex-wrap items-center gap-4">
        <GradeMark grade={grade} className="size-14 text-3xl" />
        <div>
          <h1 className="text-title">Grade {grade}</h1>
          <p className="mt-1 text-fg-muted">
            {band.label}, Grades {band.from} to {band.to} · {pluralize(courses.length, "course")}
          </p>
        </div>
      </div>

      <nav aria-label="Other grades" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {GRADES.map((other) => (
            <li key={other}>
              <Link
                href={`/grades/${other}`}
                aria-current={other === grade ? "page" : undefined}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-control border-2 border-line text-small font-bold",
                  other === grade ? cn(bandForGrade(other).tile, "shadow-sticker") : "bg-surface hover:bg-surface-sunken",
                )}
              >
                <span className="sr-only">Grade</span> {other}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {courses.length === 0 ? (
        <EmptyState
          className="mt-10"
          illustration="empty"
          title={`No Grade ${grade} courses yet`}
          description="New courses are published all the time. Meanwhile, the nearby grades may have what you need."
          action={<ButtonLink href="/courses">Browse all courses</ButtonLink>}
        />
      ) : (
        <div className="mt-10 grid gap-12">
          {[...subjects.values()].map((subject) => (
            <section key={subject.slug} aria-labelledby={`subject-${subject.slug}`}>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`subject-${subject.slug}`} className="text-heading">
                  {subject.name}
                </h2>
                <Link href={`/subjects/${subject.slug}`} className="text-small font-bold underline underline-offset-4 hover:no-underline">
                  All {subject.name} courses
                </Link>
              </div>
              <CourseGrid courses={subject.courses} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
