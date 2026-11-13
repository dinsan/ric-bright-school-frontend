import { ImageResponse } from "next/og";
import { GradeTile, OG_SIZE, OgCard } from "@/components/seo/og-card";
import { ogFonts } from "@/components/seo/og-fonts";
import { siteConfig } from "@/config/site";

// The default share image for every page without its own. Static: made once at build time.
export const alt = `${siteConfig.name}: courses for Grades 1 to 12`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Learning for Grades 1 to 12"
        title="Start with your grade."
        subtitle="Courses by grade and subject. Simple sign-in for young children. No ads."
        footer={[1, 3, 5, 7, 9, 12].map((grade) => (
          <GradeTile key={grade} grade={grade} size={88} />
        ))}
      />
    ),
    { ...size, fonts: await ogFonts() },
  );
}
