import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatPrice, pluralize } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { withBuildFallback } from "@/server/build-phase";
import { pricingOverview, type PricingOverview } from "@/server/catalog/service";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description: "Creating a Lumina account is free, and every course shows its own price on its page. Many courses are free.",
  path: "/pricing",
});

// Static and cached, refreshed from the database at most every 5 minutes; an admin changing a price
// refreshes it right away (/admin/courses). Built without a database, the numbers arrive at the first refresh.
export const revalidate = 300;

/** "$9.00 to $19.00", "$9.00", or null. */
function priceRange(min: number | null, max: number | null): string | null {
  if (min === null || max === null) return null;
  return min === max ? formatPrice(min) : `${formatPrice(min)} to ${formatPrice(max)}`;
}

/**
 * /pricing (FE-PUB-07): how paying for Lumina works, with real numbers from the catalog. There are no
 * subscription plans today, so there is nothing invented to compare: accounts are free and each course
 * has one price, set per course. A plan comparison arrives with billing (BE-BILL-01).
 */
export default async function PricingPage() {
  const overview = await withBuildFallback<PricingOverview | null>(pricingOverview, null);
  const range = overview ? priceRange(overview.min_price_cents, overview.max_price_cents) : null;

  return (
    <div className="mx-auto max-w-5xl px-gutter py-10 lg:py-14">
      <h1 className="text-title">Pricing</h1>
      <p className="mt-3 max-w-2xl text-lead text-fg-muted">
        Creating an account is free, for the whole family. Every course has one price, shown on its page
        {overview && overview.free_count > 0 ? (
          <>
            {" "}
            — and {overview.free_count === 1 ? "one course is" : `${overview.free_count} courses are`} free
          </>
        ) : null}
        . No subscriptions, no ads, no tracking.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <Card className="h-full">
          <CardTitle as="h2">Free account</CardTitle>
          <p className="text-3xl font-black">$0</p>
          <CardDescription>Everything you need to get started, free for students, parents and teachers.</CardDescription>
          <ul className="grid gap-2 text-small">
            {[
              "Browse every course by grade and subject",
              overview && overview.free_count > 0 ? `${pluralize(overview.free_count, "free course")}, marked "Free" on their pages` : 'Free courses, marked "Free" on their pages',
              "Simple sign-in for young children (class code and pictures)",
              "Parent accounts with every child in one place",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                {line}
              </li>
            ))}
          </ul>
          <ButtonLink href="/sign-up" variant="primary" className="mt-auto self-start">
            Create a free account
          </ButtonLink>
        </Card>

        <Card className="h-full">
          <CardTitle as="h2">Paid courses</CardTitle>
          <p className="text-3xl font-black">{range ?? "Per course"}</p>
          <CardDescription>
            {overview && overview.paid_count > 0
              ? `${pluralize(overview.paid_count, "course")} with a price of its own — pay only for what you learn.`
              : "Some courses have a price of their own — pay only for what you learn."}
          </CardDescription>
          <ul className="grid gap-2 text-small">
            {["One price per course, shown before you start", "No subscription: a course never charges twice", "Free courses stay free"].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                {line}
              </li>
            ))}
          </ul>
          <ButtonLink href="/courses" variant="secondary" className="mt-auto self-start">
            Browse the courses
          </ButtonLink>
        </Card>
      </div>

      {overview && overview.subjects.length > 0 && (
        <section aria-labelledby="pricing-by-subject" className="mt-14">
          <h2 id="pricing-by-subject" className="text-heading">
            Prices by subject
          </h2>
          <p className="mt-2 max-w-2xl text-fg-muted">What each subject&apos;s courses cost today. Every course&apos;s exact price is on its page.</p>
          <div className="mt-5 overflow-x-auto rounded-card border-2 border-line bg-surface">
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-line text-small text-fg-muted">
                  <th scope="col" className="px-4 py-3 font-bold">
                    Subject
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Courses
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Free
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Paid courses
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.subjects.map((subject) => (
                  <tr key={subject.id} className="border-b-2 border-line-subtle last:border-0">
                    <th scope="row" className="px-4 py-3 font-bold">
                      <Link href={`/subjects/${subject.slug}`} className="underline underline-offset-4 hover:no-underline">
                        {subject.name}
                      </Link>
                    </th>
                    <td className="px-4 py-3">{subject.course_count}</td>
                    <td className="px-4 py-3">{subject.free_count}</td>
                    <td className="px-4 py-3">{priceRange(subject.min_price_cents, subject.max_price_cents) ?? "All free"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="pricing-questions" className="mt-14 grid max-w-2xl gap-6">
        <h2 id="pricing-questions" className="text-heading">
          Good to know
        </h2>
        <div>
          <h3 className="font-extrabold">How do I pay?</h3>
          <p className="mt-1 text-fg-muted">
            Online checkout is still being built. Until it arrives, the price on each course page tells you what that course will cost — nothing is charged today.
          </p>
        </div>
        <div>
          <h3 className="font-extrabold">Do schools pay per student?</h3>
          <p className="mt-1 text-fg-muted">
            School licenses are planned. Until then, <Link href="/contact" className="underline underline-offset-4 hover:no-underline">contact us</Link> and we will work something out together.
          </p>
        </div>
        <div>
          <h3 className="font-extrabold">Will prices change?</h3>
          <p className="mt-1 text-fg-muted">Prices can change, but the price shown when you start a course is the one that counts for it.</p>
        </div>
      </section>
    </div>
  );
}
