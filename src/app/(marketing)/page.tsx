import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { GradePicker } from "@/features/catalog/components/grade-picker";
import { Audiences } from "@/features/marketing/components/audiences";
import { Faq } from "@/features/marketing/components/faq";
import { HowItWorks } from "@/features/marketing/components/how-it-works";
import { LessonPreview } from "@/features/marketing/components/lesson-preview";
import { SafetyStrip } from "@/features/marketing/components/safety-strip";
import { MarketingSection } from "@/features/marketing/components/section";
import { SubjectOverview } from "@/features/marketing/components/subject-overview";
import { organizationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";
import { withBuildFallback } from "@/server/build-phase";
import { catalogOverview } from "@/server/catalog/service";

export const metadata: Metadata = pageMetadata({ description: siteConfig.longDescription, path: "/" });

// Static and cached, refreshed from the database at most every 5 minutes (new courses and subjects
// appear without a deploy). Built without a database, the catalog sections arrive at the first refresh.
export const revalidate = 300;

export default async function HomePage() {
  const overview = await withBuildFallback(catalogOverview, null);
  const courseCount = overview?.course_count ?? 0;

  return (
    <>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />

      {/* The grade picker stays the first thing a visitor sees. */}
      <section aria-labelledby="hero-title" className="mx-auto grid max-w-6xl gap-12 px-gutter py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16 lg:py-24">
        <div>
          <h1 id="hero-title" className="text-display">
            Start with your grade.
          </h1>
          <p className="mt-5 max-w-md text-lead text-fg-muted">
            {courseCount > 0 ? `Lumina has ${courseCount} courses` : "Lumina has courses"} for every grade from 1 to 12. Pick a
            grade to see what you can learn, or browse everything by subject.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/courses" variant="primary">
              Browse all courses
            </ButtonLink>
            <ButtonLink href="#sample-lesson" variant="secondary">
              Try a sample lesson
            </ButtonLink>
          </div>
        </div>
        <GradePicker />
      </section>

      {overview && overview.subjects.length > 0 && (
        <MarketingSection id="subjects" title="Explore by subject" lead="Every subject, with courses for the grades it covers.">
          <SubjectOverview subjects={overview.subjects} />
        </MarketingSection>
      )}

      <MarketingSection id="how-it-works" title="How Lumina works" lead="Short lessons, one idea at a time, for every age.">
        <HowItWorks />
      </MarketingSection>

      <MarketingSection
        id="sample-lesson"
        title="What a lesson looks like"
        lead="Have a go: this is a real, working lesson in miniature. Nothing you do here is saved."
      >
        <div className="max-w-3xl">
          <LessonPreview />
        </div>
      </MarketingSection>

      <MarketingSection id="families-and-teachers" title="For families and teachers" lead="Parents set up their children's accounts. Teachers plan from courses for every grade.">
        <Audiences />
      </MarketingSection>

      <div className="border-y-2 border-line bg-surface">
        <MarketingSection id="safety" title="Safe for children, by design" lead="Lumina is built for children first. These promises hold for every account.">
          <SafetyStrip />
        </MarketingSection>
      </div>

      <MarketingSection id="faq" title="Questions and answers">
        <Faq />
      </MarketingSection>

      <section aria-labelledby="get-started" className="mx-auto max-w-6xl px-gutter pb-20">
        <div className="grid gap-5 rounded-card border-2 border-line bg-primary p-card text-primary-fg shadow-sticker-lg sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 id="get-started" className="text-title">
              Ready when you are.
            </h2>
            <p className="mt-2 text-lead">Browse the courses for your grade, or create an account for your family or class.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/courses" variant="secondary">
              Browse courses
            </ButtonLink>
            <ButtonLink href="/sign-up" variant="secondary">
              Create an account
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
