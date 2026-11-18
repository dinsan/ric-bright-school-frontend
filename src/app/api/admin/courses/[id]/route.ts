import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { coursePriceInput, updateCoursePrice } from "@/server/admin/catalog";
import { requireAuth } from "@/server/auth/context";
import { parseBody, parseId } from "@/server/http/validation";
import { json, type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

export const PATCH = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["admin"]);
  const id = parseId((await params).id, "That course");
  const course = await updateCoursePrice(auth, id, await parseBody(request, coursePriceInput), request);
  // The cached public pages that show this price (same-app publishing: revalidate directly, FE-PERF-03).
  // Best effort: every page also refreshes on its own within minutes (ISR).
  try {
    revalidatePath(`/courses/${course.slug}`);
    revalidatePath(`/grades/${course.grade_level}`);
    revalidatePath(`/subjects/${course.subject.slug}`);
    revalidatePath("/pricing");
  } catch {
    // Outside a Next.js request scope (tests): nothing to refresh.
  }
  return json(course);
});
