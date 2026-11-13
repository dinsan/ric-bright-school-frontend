import { Clock } from "lucide-react";
import { pluralize } from "@/lib/format";
import { LessonTarget } from "./lesson-target";

export interface OutlineLesson {
  id: string;
  slug: string;
  title: string;
  summary: string;
  position: number;
  durationMinutes: number | null;
}

/** Anchor of a lesson in its course outline; search results link here. */
export const lessonAnchor = (slug: string) => `lesson-${slug}`;

export function totalMinutes(lessons: OutlineLesson[]): number {
  return lessons.reduce((sum, lesson) => sum + (lesson.durationMinutes ?? 0), 0);
}

/**
 * The lessons of a course, in order. Each lesson has an anchor (#lesson-…) so search results and
 * shared links land on it; the targeted lesson is highlighted.
 */
export function CourseOutline({ lessons }: { lessons: OutlineLesson[] }) {
  return (
    <section aria-labelledby="lessons-title" className="mt-10 max-w-2xl">
      <h2 id="lessons-title" className="text-heading">
        Lessons
      </h2>
      <p className="mt-1 text-small text-fg-muted">
        {pluralize(lessons.length, "lesson")}
        {totalMinutes(lessons) > 0 && `, about ${totalMinutes(lessons)} minutes in all`}
      </p>
      <ol className="mt-5 grid gap-3">
        {lessons.map((lesson) => (
          <li
            key={lesson.id}
            id={lessonAnchor(lesson.slug)}
            tabIndex={-1}
            className="grid scroll-mt-6 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-card border-2 border-line bg-surface p-4 target:bg-accent target:text-accent-fg data-targeted:bg-accent data-targeted:text-accent-fg"
          >
            <span aria-hidden className="row-span-2 inline-flex size-9 items-center justify-center rounded-full border-2 border-line bg-surface-sunken font-black text-fg">
              {lesson.position}
            </span>
            <h3 className="text-lead font-extrabold wrap-break-word">
              {/* The space outside the hidden span: accessible-name algorithms may trim it inside. */}
              <span className="sr-only">Lesson {lesson.position}:</span> {lesson.title}
            </h3>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-small">
              <p>{lesson.summary}</p>
              {lesson.durationMinutes && (
                <span className="inline-flex items-center gap-1 font-bold whitespace-nowrap">
                  <Clock aria-hidden className="size-4" />
                  {lesson.durationMinutes} min
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <LessonTarget />
    </section>
  );
}
