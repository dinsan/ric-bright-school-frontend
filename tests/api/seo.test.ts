import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getDb } from "@/server/db";
import { catalogOverview, gradeCourses, pricingOverview, relatedCourses, subjectWithCourses, toCourse } from "@/server/catalog/service";
import { jsonLdString, pageMetadata } from "@/lib/seo";
import { createCatalog } from "../support/factories";

describe("sitemap.xml", () => {
  it("lists the public pages and every published course, not drafts", async () => {
    await createCatalog();
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://localhost:3000",
        "http://localhost:3000/courses",
        "http://localhost:3000/courses/fractions",
        "http://localhost:3000/courses/counting",
        "http://localhost:3000/pricing",
        "http://localhost:3000/grades/1",
        "http://localhost:3000/grades/12",
        "http://localhost:3000/subjects/mathematics",
        "http://localhost:3000/subjects/science",
        "http://localhost:3000/privacy",
        "http://localhost:3000/terms",
        "http://localhost:3000/cookies",
        "http://localhost:3000/safety",
        "http://localhost:3000/contact",
      ]),
    );
    expect(urls.some((url) => url.includes("secret-draft"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
    expect(entries.find((entry) => entry.url.endsWith("/courses/fractions"))?.lastModified).toBeInstanceOf(Date);
  });

  it("still works with an empty catalog", async () => {
    const entries = await sitemap();
    // The fixed pages and the twelve grade pages; no course or subject pages.
    expect(entries.length).toBe(8 + 12);
    expect(entries.some((entry) => entry.url.includes("/subjects/"))).toBe(false);
  });
});

describe("robots.txt", () => {
  it("opens public pages, closes the API, sign-in plumbing and signed-in areas, and names the sitemap", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0]! : result.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(expect.arrayContaining(["/api/", "/auth/", "/account", "/admin", "/reset-password"]));
    expect(result.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });
});

describe("catalog overview (home page)", () => {
  it("counts published courses per subject and grade, and ignores drafts", async () => {
    await createCatalog();
    await getDb().course.update({ where: { slug: "plants" }, data: { status: "archived" } });
    const overview = await catalogOverview();
    expect(overview.course_count).toBe(2);
    expect(overview.subjects).toEqual([
      expect.objectContaining({ slug: "mathematics", course_count: 2, min_grade: 1, max_grade: 4 }),
    ]);
    expect(overview.courses_per_grade[1]).toBe(1);
    expect(overview.courses_per_grade[4]).toBe(1);
    expect(overview.courses_per_grade[12]).toBe(0);
  });
});

describe("metadata helpers", () => {
  it("builds a canonical URL and matching social cards, with the site image unless the page has its own", () => {
    const metadata = pageMetadata({ title: "Privacy policy", description: "What we keep.", path: "/privacy" });
    expect(metadata.alternates?.canonical).toBe("/privacy");
    expect(metadata.openGraph).toMatchObject({ url: "/privacy", title: "Privacy policy · Lumina", description: "What we keep." });
    expect(metadata.openGraph?.images).toBeDefined();
    const course = pageMetadata({ title: "Fractions", description: "…", path: "/courses/fractions", ownImage: true });
    expect(course.openGraph?.images).toBeUndefined();
  });

  it("escapes JSON-LD so text from the database can't close the script tag", () => {
    const text = jsonLdString({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("grade and subject pages (FE-PUB-03)", () => {
  it("lists a grade's published courses in subject then title order", async () => {
    await createCatalog();
    const grade4 = await gradeCourses(4);
    expect(grade4.map((course) => course.slug)).toEqual(["fractions", "plants"]); // never the draft
    expect(await gradeCourses(12)).toEqual([]);
  });

  it("lists a subject's published courses in grade order, and null for unknown subjects", async () => {
    await createCatalog();
    const maths = await subjectWithCourses("mathematics");
    expect(maths?.subject.name).toBe("Mathematics");
    expect(maths?.courses.map((course) => course.slug)).toEqual(["counting", "fractions"]);
    expect(await subjectWithCourses("astrology")).toBeNull();
    expect(await subjectWithCourses("x".repeat(100))).toBeNull();
  });
});

describe("related courses (FE-PUB-05)", () => {
  it("prefers the same subject in nearby grades, topped up with the same grade's other subjects", async () => {
    await createCatalog();
    const fractions = await getDb().course.findUnique({ where: { slug: "fractions" }, include: { subject: true } });
    const related = await relatedCourses(toCourse(fractions!, fractions!.subject));
    // Same subject (counting, grade 1) first, then the same grade's science course; never itself or drafts.
    expect(related.map((course) => course.slug)).toEqual(["counting", "plants"]);
  });
});

describe("pricing overview (FE-PUB-07)", () => {
  it("counts free and paid published courses and the price range per subject", async () => {
    await createCatalog();
    const overview = await pricingOverview();
    expect(overview).toMatchObject({ free_count: 2, paid_count: 1, min_price_cents: 1250, max_price_cents: 1250 });
    expect(overview.subjects).toEqual([
      expect.objectContaining({ slug: "mathematics", course_count: 2, free_count: 1, min_price_cents: 1250, max_price_cents: 1250 }),
      expect.objectContaining({ slug: "science", course_count: 1, free_count: 1, min_price_cents: null, max_price_cents: null }),
    ]);
  });

  it("handles an empty catalog", async () => {
    expect(await pricingOverview()).toEqual({ free_count: 0, paid_count: 0, min_price_cents: null, max_price_cents: null, subjects: [] });
  });
});
