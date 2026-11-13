import "server-only";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { isSearchable, parseSearchQuery, type ParsedQuery } from "@/features/search/query";
import { SEARCH_MAX_LENGTH, type SearchHit, type SearchResults } from "@/features/search/types";
import { getDb } from "@/server/db";

/**
 * Global search across published courses and their lessons, in PostgreSQL.
 *
 * 1. Full text: every word must match, as a prefix, so results appear while typing ("frac" finds
 *    "Fractions"). Each word is tried with English stemming ("fractions" → "fraction") and as written
 *    ("add" → "adding"); the indexed text has both forms too (search_vector). Weighted: title > summary >
 *    description. Subject names count ("science"); a grade in the query ("grade 4") is a filter.
 * 2. Typos: only when full text finds nothing (for courses or for lessons), titles that look like the
 *    query are returned instead ("fracton" → "Fractions"), marked `approximate`. As a fallback only,
 *    because trigram similarity on its own also finds unrelated titles ("fraction" ~ "subtraction").
 * GIN indexes on the search vectors and titles keep both fast (prisma/schema.prisma, Course and Lesson).
 *
 * Raw SQL (Prisma.sql tagged templates: every value is a bound parameter, never spliced into the text),
 * because Prisma's query API has no tsquery, ranking or trigram operators.
 */

export const searchInput = z.object({
  q: z.string().trim().max(SEARCH_MAX_LENGTH).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

/** word_similarity from which a title is a close match (a dropped or doubled letter: "plnts", "calculas"). */
const FUZZY = 0.4;

const empty = (query: string, grade: number | null = null): SearchResults => ({
  query,
  grade,
  courses: [],
  lessons: [],
  more: { courses: false, lessons: false },
  approximate: false,
});

export async function search({ q, limit }: z.output<typeof searchInput>): Promise<SearchResults> {
  const parsed = parseSearchQuery(q);
  if (!isSearchable(parsed)) return empty(q, parsed.grade);
  const take = limit + 1;
  let [courseHits, lessonHits] = await Promise.all([searchCourses(parsed, take, "exact"), parsed.terms.length ? searchLessons(parsed, take, "exact") : []]);
  let approximate = false;
  if (parsed.terms.length && courseHits.length === 0 && lessonHits.length === 0) {
    [courseHits, lessonHits] = await Promise.all([searchCourses(parsed, take, "similar"), searchLessons(parsed, take, "similar")]);
    approximate = courseHits.length + lessonHits.length > 0;
  }
  return {
    query: q,
    grade: parsed.grade,
    courses: courseHits.slice(0, limit),
    lessons: lessonHits.slice(0, limit),
    more: { courses: courseHits.length > limit, lessons: lessonHits.length > limit },
    approximate,
  };
}

/** Every word as a prefix, stemmed or as written, all required: (english 'frac:*' | simple 'frac:*') && … */
function tsquery(terms: string[]): Prisma.Sql {
  return Prisma.join(
    terms.map((term) => Prisma.sql`(to_tsquery('english', ${`${term}:*`}) || to_tsquery('simple', ${`${term}:*`}))`),
    " && ",
  );
}

const and = (filters: Prisma.Sql[]) => Prisma.join(filters, " and ");

type Mode = "exact" | "similar";

interface CourseHitRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  grade_level: number;
  subject_slug: string;
  subject_name: string;
}

async function searchCourses(parsed: ParsedQuery, take: number, mode: Mode): Promise<SearchHit[]> {
  const filters: Prisma.Sql[] = [Prisma.sql`c.status = 'published'`];
  if (parsed.grade !== null) filters.push(Prisma.sql`c.grade_level = ${parsed.grade}`);
  // Only a grade: that grade's courses by title.
  let score: Prisma.Sql | null = null;
  if (parsed.terms.length && mode === "exact") {
    const query = Prisma.sql`(${tsquery(parsed.terms)})`;
    const subjectVector = Prisma.sql`(to_tsvector('english', s.name) || to_tsvector('simple', s.name))`;
    filters.push(Prisma.sql`(c.search_vector @@ ${query} or ${subjectVector} @@ ${query})`);
    score = Prisma.sql`ts_rank_cd(c.search_vector, ${query}) + case when ${subjectVector} @@ ${query} then 0.3 else 0 end`;
  } else if (parsed.terms.length) {
    filters.push(Prisma.sql`word_similarity(${parsed.text}, c.title) >= ${FUZZY}`);
    score = Prisma.sql`word_similarity(${parsed.text}, c.title)`;
  }
  const rows = await getDb().$queryRaw<CourseHitRow[]>`
    select c.id, c.slug, c.title, c.summary, c.grade_level, s.slug as subject_slug, s.name as subject_name
    from courses c
    join subjects s on s.id = c.subject_id
    where ${and(filters)}
    order by ${score ? Prisma.sql`${score} desc, ` : Prisma.empty}c.grade_level asc, c.title asc
    limit ${take}`;
  return rows.map((row) => ({
    kind: "course",
    id: row.id,
    title: row.title,
    summary: row.summary,
    url: `/courses/${row.slug}`,
    grade_level: row.grade_level,
    subject: { slug: row.subject_slug, name: row.subject_name },
  }));
}

interface LessonHitRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  duration_minutes: number | null;
  course_slug: string;
  course_title: string;
  grade_level: number;
  subject_slug: string;
  subject_name: string;
}

async function searchLessons(parsed: ParsedQuery, take: number, mode: Mode): Promise<SearchHit[]> {
  const filters: Prisma.Sql[] = [Prisma.sql`c.status = 'published'`];
  if (parsed.grade !== null) filters.push(Prisma.sql`c.grade_level = ${parsed.grade}`);
  let score: Prisma.Sql;
  if (mode === "exact") {
    const query = Prisma.sql`(${tsquery(parsed.terms)})`;
    // A lesson also carries its course's title, at the lowest weight, so "egypt pyramids" finds
    // "Pharaohs and pyramids" in "Ancient Egypt"; lessons matching by their own words still rank first.
    // Computed per query (not indexed): fine for thousands of lessons; store it if the catalog grows large.
    const vector = Prisma.sql`(l.search_vector || setweight(to_tsvector('english', c.title) || to_tsvector('simple', c.title), 'D'))`;
    filters.push(Prisma.sql`${vector} @@ ${query}`);
    score = Prisma.sql`ts_rank_cd(${vector}, ${query})`;
  } else {
    filters.push(Prisma.sql`word_similarity(${parsed.text}, l.title) >= ${FUZZY}`);
    score = Prisma.sql`word_similarity(${parsed.text}, l.title)`;
  }
  const rows = await getDb().$queryRaw<LessonHitRow[]>`
    select l.id, l.slug, l.title, l.summary, l.duration_minutes,
           c.slug as course_slug, c.title as course_title, c.grade_level,
           s.slug as subject_slug, s.name as subject_name
    from lessons l
    join courses c on c.id = l.course_id
    join subjects s on s.id = c.subject_id
    where ${and(filters)}
    order by ${score} desc, c.grade_level asc, l.position asc
    limit ${take}`;
  return rows.map((row) => ({
    kind: "lesson",
    id: row.id,
    title: row.title,
    summary: row.summary,
    url: `/courses/${row.course_slug}#lesson-${row.slug}`,
    grade_level: row.grade_level,
    subject: { slug: row.subject_slug, name: row.subject_name },
    course: { slug: row.course_slug, title: row.course_title },
    duration_minutes: row.duration_minutes,
  }));
}
