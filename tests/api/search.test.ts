import { describe, expect, it } from "vitest";
import { GET as search } from "@/app/api/search/route";
import { GET as courseBySlug } from "@/app/api/courses/slug/[slug]/route";
import type { SearchResults } from "@/features/search/types";
import { Browser } from "../support/browser";
import { createCatalog } from "../support/factories";

const find = async (q: string, limit?: number) => {
  const query = new URLSearchParams({ q, ...(limit ? { limit: String(limit) } : {}) });
  return new Browser().call<SearchResults>(search, { path: `/api/search?${query}` });
};
const titles = (hits: Array<{ title: string }>) => hits.map((hit) => hit.title);

describe("global search", () => {
  it("finds courses and lessons while typing (every word is a prefix)", async () => {
    await createCatalog();
    const { status, body, headers } = await find("frac");
    expect(status).toBe(200);
    expect(titles(body.courses)).toEqual(["Fractions Made Simple"]);
    expect(titles(body.lessons)).toEqual(expect.arrayContaining(["What is a fraction?", "Equivalent fractions"]));
    expect(headers.get("cache-control")).toContain("public");
  });

  it("links lessons to their place in the course outline and says which course they belong to", async () => {
    await createCatalog();
    const { body } = await find("equivalent");
    expect(body.lessons[0]).toMatchObject({
      kind: "lesson",
      title: "Equivalent fractions",
      url: "/courses/fractions#lesson-equivalent-fractions",
      grade_level: 4,
      subject: { slug: "mathematics", name: "Mathematics" },
      course: { slug: "fractions", title: "Fractions Made Simple" },
      duration_minutes: 15,
    });
  });

  it("ranks title matches first and uses stemming (plural, singular)", async () => {
    await createCatalog();
    const { body } = await find("plant");
    expect(titles(body.courses)).toEqual(["Plants and How They Grow"]);
    expect(titles(body.lessons)[0]).toBe("Parts of a plant");
  });

  it("forgives typos when nothing matches exactly, and says the results are approximate", async () => {
    await createCatalog();
    const typo = await find("fracton");
    expect(typo.body.approximate).toBe(true);
    expect(titles(typo.body.courses)).toEqual(["Fractions Made Simple"]);
    expect(titles((await find("plnts")).body.courses)).toContain("Plants and How They Grow");
  });

  it("doesn't mix look-alike titles into exact results (fraction ≠ subtraction)", async () => {
    await createCatalog();
    const { body } = await find("fraction");
    expect(body.approximate).toBe(false);
    for (const hit of [...body.courses, ...body.lessons]) expect(hit.title.toLowerCase()).toContain("fraction");
  });

  it("finds lessons by their course's title too, ranking a lesson's own words first", async () => {
    await createCatalog();
    const { body } = await find("fractions quarters");
    expect(titles(body.lessons).sort()).toEqual(["Equivalent fractions", "What is a fraction?"]);
    const plants = await find("plants roots");
    expect(titles(plants.body.lessons)).toEqual(["Parts of a plant"]);
    const simple = await find("simple");
    expect(titles(simple.body.courses)).toEqual(["Fractions Made Simple"]);
    expect(titles(simple.body.lessons).sort()).toEqual(["Equivalent fractions", "What is a fraction?"]);
  });

  it("matches words as written as well as stemmed (add → adding, count → counting)", async () => {
    await createCatalog();
    expect(titles((await find("count")).body.courses)).toEqual(["Counting to 100"]);
    expect(titles((await find("quarter")).body.lessons).sort()).toEqual(["Equivalent fractions", "What is a fraction?"]);
  });

  it("finds courses by subject name, and understands grades as a filter", async () => {
    await createCatalog();
    expect(titles((await find("science")).body.courses)).toEqual(["Plants and How They Grow"]);
    const grade4 = await find("grade 4");
    expect(grade4.body.grade).toBe(4);
    expect(titles(grade4.body.courses)).toEqual(["Fractions Made Simple", "Plants and How They Grow"]);
    const grade1maths = await find("1st grade count");
    expect(titles(grade1maths.body.courses)).toEqual(["Counting to 100"]);
    expect(titles(grade1maths.body.lessons)).toEqual(["Tens and ones"]);
  });

  it("never shows drafts, or lessons of draft courses", async () => {
    await createCatalog();
    const { body } = await find("secret hidden draft");
    expect(body.courses).toEqual([]);
    expect(body.lessons).toEqual([]);
    expect(titles((await find("hidden")).body.lessons)).toEqual([]);
  });

  it("limits results and says when there are more", async () => {
    await createCatalog();
    const { body } = await find("fraction", 1);
    expect(body.lessons).toHaveLength(1);
    expect(body.more.lessons).toBe(true);
    expect(body.more.courses).toBe(false);
  });

  it("returns nothing for empty, one-letter or punctuation-only queries, and treats SQL as plain words", async () => {
    await createCatalog();
    for (const q of ["", " ", "f", "'", "&|!():*<>\\", "%_"]) {
      const { status, body } = await find(q);
      expect(status).toBe(200);
      expect(body.courses).toEqual([]);
      expect(body.lessons).toEqual([]);
    }
    // Punctuation is dropped, words are kept: "1" matches "Counting to 100", nothing breaks.
    const injection = await find("' or 1=1; drop table courses; --");
    expect(injection.status).toBe(200);
    expect((await find("fraction's (simple)")).body.courses.map((hit) => hit.title)).toEqual(["Fractions Made Simple"]);
    expect((await find("counting")).body.courses).toHaveLength(1);
  });

  it("refuses over-long queries and limits", async () => {
    expect((await find("x".repeat(101))).status).toBe(422);
    expect((await find("fractions", 51)).status).toBe(422);
  });
});

describe("course outline", () => {
  it("the course API still answers without lessons (they're on the page)", async () => {
    await createCatalog();
    const { status } = await new Browser().call(courseBySlug, { path: "/api/courses/slug/fractions", params: { slug: "fractions" } });
    expect(status).toBe(200);
  });
});
