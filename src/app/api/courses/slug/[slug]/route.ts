import { getCourseBySlug } from "@/server/catalog/service";
import { HttpError } from "@/server/http/errors";
import { json, type Params, route } from "@/server/http/route";

export const GET = route(async (_request, { params }: Params<{ slug: string }>) => {
  const course = await getCourseBySlug((await params).slug);
  if (!course) throw new HttpError(404, "course_not_found", "That course was not found.");
  return json(course, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } });
});
