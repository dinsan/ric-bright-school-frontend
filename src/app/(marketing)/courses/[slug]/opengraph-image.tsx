import { ImageResponse } from "next/og";
import { GradeTile, OG_SIZE, OgCard } from "@/components/seo/og-card";
import { ogFonts } from "@/components/seo/og-fonts";
import { getCourseBySlug } from "@/server/catalog/service";

// One share image per course, made on first request and cached like the page (nothing at build time).
export const revalidate = 3600;
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export const alt = "Course on Lumina";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const course = await getCourseBySlug((await params).slug);
  return new ImageResponse(
    course ? (
      <OgCard
        eyebrow={course.subject.name}
        title={course.title}
        subtitle={course.summary.length > 110 ? `${course.summary.slice(0, 107)}…` : course.summary}
        footer={
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <GradeTile grade={course.grade_level} size={88} />
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800 }}>{`Grade ${course.grade_level}`}</div>
          </div>
        }
      />
    ) : (
      <OgCard eyebrow="Courses" title="Courses for Grades 1 to 12" />
    ),
    { ...size, fonts: await ogFonts() },
  );
}
