import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getDb } from "@/server/db";
import { catalogOverview } from "@/server/catalog/service";
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
    expect(entries.length).toBe(7);
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
