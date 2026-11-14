import { describe, expect, it } from "vitest";
import { GET as listCourses } from "@/app/api/courses/route";
import { GET as courseBySlug } from "@/app/api/courses/slug/[slug]/route";
import { GET as listSubjects } from "@/app/api/subjects/route";
import { GET as unknownEndpoint } from "@/app/api/[...path]/route";
import { Browser } from "../support/browser";
import { createCatalog } from "../support/factories";

describe("catalog API", () => {
  it("lists published courses only, with their subject, sorted by grade then title", async () => {
    await createCatalog();
    const { status, body, headers } = await new Browser().call(listCourses, { path: "/api/courses" });
    expect(status).toBe(200);
    expect(body.total).toBe(3);
    expect(body.items.map((course: { slug: string }) => course.slug)).toEqual(["counting", "fractions", "plants"]);
    expect(body.items[0].subject).toMatchObject({ slug: "mathematics", name: "Mathematics" });
    expect(body).toMatchObject({ limit: 12, offset: 0 });
    expect(headers.get("cache-control")).toContain("public");
  });

  it("filters by grade, subject and text (with % taken literally), and paginates", async () => {
    await createCatalog();
    const browser = new Browser();
    const grade4 = await browser.call(listCourses, { path: "/api/courses?grade_level=4" });
    expect(grade4.body.items.map((course: { slug: string }) => course.slug)).toEqual(["fractions", "plants"]);
    const science = await browser.call(listCourses, { path: "/api/courses?subject=science" });
    expect(science.body.total).toBe(1);
    const search = await browser.call(listCourses, { path: "/api/courses?q=FRACTION" });
    expect(search.body.items[0].slug).toBe("fractions");
    const percent = await browser.call(listCourses, { path: "/api/courses?q=100%25" });
    expect(percent.body.items.map((course: { slug: string }) => course.slug)).toEqual(["plants"]);
    const page2 = await browser.call(listCourses, { path: "/api/courses?limit=2&offset=2" });
    expect(page2.body).toMatchObject({ total: 3, limit: 2, offset: 2 });
    expect(page2.body.items).toHaveLength(1);
  });

  it("rejects invalid filters with field details", async () => {
    const { status, body } = await new Browser().call(listCourses, { path: "/api/courses?grade_level=13" });
    expect(status).toBe(422);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details[0].field).toBe("query.grade_level");
    expect(body.error.request_id).toBeTruthy();
  });

  it("finds a published course by slug and hides drafts", async () => {
    await createCatalog();
    const browser = new Browser();
    const found = await browser.call(courseBySlug, { path: "/api/courses/slug/fractions", params: { slug: "fractions" } });
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ slug: "fractions", grade_level: 4, status: "published", price_cents: 1250 });
    const draft = await browser.call(courseBySlug, { path: "/api/courses/slug/secret-draft", params: { slug: "secret-draft" } });
    expect(draft.status).toBe(404);
    expect(draft.body.error.code).toBe("course_not_found");
  });

  it("lists subjects by name", async () => {
    await createCatalog();
    const { body } = await new Browser().call(listSubjects, { path: "/api/subjects" });
    expect(body.map((subject: { name: string }) => subject.name)).toEqual(["Mathematics", "Science"]);
  });

  it("answers unknown API paths with a JSON 404", async () => {
    const response = await unknownEndpoint();
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });
});
