import type { MetadataRoute } from "next";
import { legalConfig } from "@/config/legal";
import { absoluteUrl } from "@/config/site";
import { publishedCourseUrls } from "@/server/catalog/service";

// Rendered on request, so new and updated courses are always listed (crawlers fetch it rarely, and the
// query is small). Never prerendered, so builds don't need the database.
export const dynamic = "force-dynamic";

/** /sitemap.xml: the public pages and every published course. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await publishedCourseUrls();
  const latestCourse = courses.reduce<Date | undefined>((latest, course) => (!latest || course.updatedAt > latest ? course.updatedAt : latest), undefined);
  const docs = legalConfig.documents;
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1, ...(latestCourse ? { lastModified: latestCourse } : {}) },
    { url: absoluteUrl("/courses"), changeFrequency: "daily", priority: 0.9, ...(latestCourse ? { lastModified: latestCourse } : {}) },
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
