import type { MetadataRoute } from "next";
import { legalConfig } from "@/config/legal";
import { absoluteUrl } from "@/config/site";
import { GRADES } from "@/features/catalog/constants";
import { publishedCourseUrls, publishedSubjectUrls } from "@/server/catalog/service";

// Rendered on request, so new and updated courses are always listed (crawlers fetch it rarely, and the
// query is small). Never prerendered, so builds don't need the database.
export const dynamic = "force-dynamic";

/** /sitemap.xml: the public pages, every published course, and the grade and subject pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, subjects] = await Promise.all([publishedCourseUrls(), publishedSubjectUrls()]);
  const latestCourse = courses.reduce<Date | undefined>((latest, course) => (!latest || course.updatedAt > latest ? course.updatedAt : latest), undefined);
  const docs = legalConfig.documents;
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1, ...(latestCourse ? { lastModified: latestCourse } : {}) },
    { url: absoluteUrl("/courses"), changeFrequency: "daily", priority: 0.9, ...(latestCourse ? { lastModified: latestCourse } : {}) },
    { url: absoluteUrl("/pricing"), changeFrequency: "weekly", priority: 0.6, ...(latestCourse ? { lastModified: latestCourse } : {}) },
    // The grade pages exist even before a grade has courses (they say so and point elsewhere).
    ...GRADES.map((grade) => ({
      url: absoluteUrl(`/grades/${grade}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      ...(latestCourse ? { lastModified: latestCourse } : {}),
    })),
    ...subjects.map((subject) => ({
      url: absoluteUrl(`/subjects/${subject.slug}`),
      lastModified: subject.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...courses.map((course) => ({
      url: absoluteUrl(`/courses/${course.slug}`),
      lastModified: course.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: absoluteUrl("/safety"), lastModified: docs.safety.updated, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/privacy"), lastModified: docs.privacy.updated, changeFrequency: "yearly", priority: 0.4 },
    { url: absoluteUrl("/terms"), lastModified: docs.terms.updated, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/cookies"), lastModified: docs.cookies.updated, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.4 },
  ];
}
