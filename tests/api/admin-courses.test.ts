import { describe, expect, it } from "vitest";
import { PATCH as setPrice } from "@/app/api/admin/courses/[id]/route";
import { GET as searchCourses } from "@/app/api/admin/courses/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as courseBySlug } from "@/app/api/courses/slug/[slug]/route";
import { getDb } from "@/server/db";
import { Browser } from "../support/browser";
import { createCatalog, createUser, PASSWORD } from "../support/factories";

async function signedIn(email: string) {
  const browser = new Browser();
  expect((await browser.call(login, { method: "POST", path: "/api/auth/login", body: { email, password: PASSWORD } })).status).toBe(200);
  return browser;
}

describe("admin course prices", () => {
  it("is for admins only", async () => {
    await createCatalog();
    await createUser({ role: "teacher", email: "t@example.test" });
    const teacher = await signedIn("t@example.test");
    expect((await teacher.call(searchCourses, { path: "/api/admin/courses" })).status).toBe(403);
    expect((await new Browser().call(searchCourses, { path: "/api/admin/courses" })).status).toBe(401);
  });

  it("lists every course (drafts too) with its price, searches and filters by status", async () => {
    await createCatalog();
    await createUser({ role: "admin", email: "admin@example.test" });
    const admin = await signedIn("admin@example.test");

    const all = await admin.call(searchCourses, { path: "/api/admin/courses" });
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(4); // includes the draft, which the public API hides
    expect(all.body.items.map((course: { slug: string }) => course.slug)).toEqual(["counting", "fractions", "plants", "secret-draft"]);
    const fractions = all.body.items.find((course: { slug: string }) => course.slug === "fractions");
    expect(fractions).toMatchObject({ price_cents: 1250, status: "published" });

    const drafts = await admin.call(searchCourses, { path: "/api/admin/courses?status=draft" });
    expect(drafts.body.items.map((course: { slug: string }) => course.slug)).toEqual(["secret-draft"]);
    const bySubject = await admin.call(searchCourses, { path: "/api/admin/courses?q=science" });
    expect(bySubject.body.items.map((course: { slug: string }) => course.slug)).toEqual(["plants"]);
    expect((await admin.call(searchCourses, { path: "/api/admin/courses?status=imaginary" })).status).toBe(422);
  });

  it("changes a price, shows it on the public course, and records the change", async () => {
    await createCatalog();
    const adminUser = await createUser({ role: "admin", email: "admin@example.test" });
    const admin = await signedIn("admin@example.test");
    const course = await getDb().course.findUnique({ where: { slug: "counting" } });

    const updated = await admin.call(setPrice, { method: "PATCH", path: "/api/admin/courses/x", params: { id: course!.id }, body: { price_cents: 990 } });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ slug: "counting", price_cents: 990 });

    const publicView = await new Browser().call(courseBySlug, { path: "/api/courses/slug/counting", params: { slug: "counting" } });
    expect(publicView.body.price_cents).toBe(990);

    const events = await getDb().auditEvent.findMany({ where: { action: "admin.course_price_updated" } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: adminUser.id, data: { course_id: course!.id, slug: "counting", from: 0, to: 990 } });

    // Back to free.
    const free = await admin.call(setPrice, { method: "PATCH", path: "/api/admin/courses/x", params: { id: course!.id }, body: { price_cents: 0 } });
    expect(free.body.price_cents).toBe(0);
  });

  it("refuses prices that aren't prices", async () => {
    await createCatalog();
    await createUser({ role: "admin", email: "admin@example.test" });
    const admin = await signedIn("admin@example.test");
    const course = await getDb().course.findUnique({ where: { slug: "counting" } });

    for (const price_cents of [-1, 1.5, 100_000, "12.50"]) {
      const refused = await admin.call(setPrice, { method: "PATCH", path: "/api/admin/courses/x", params: { id: course!.id }, body: { price_cents } });
      expect(refused.status).toBe(422);
      expect(refused.body.error.details[0].field).toBe("body.price_cents");
    }
    const missing = await admin.call(setPrice, { method: "PATCH", path: "/api/admin/courses/x", params: { id: crypto.randomUUID() }, body: { price_cents: 100 } });
    expect(missing.status).toBe(404);
    expect((await admin.call(setPrice, { method: "PATCH", path: "/api/admin/courses/x", params: { id: "not-a-uuid" }, body: { price_cents: 100 } })).status).toBe(404);
  });
});
