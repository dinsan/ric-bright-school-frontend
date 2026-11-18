import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { percentComplete } from "../analytics";
import type { LessonView } from "../contract";

const statusLabel = { completed: "done", started: "started", not_started: "not started" } as const;

/**
 * The course outline beside the lesson (a sidebar on large screens, a drawer on small ones): every
 * lesson with the student's status, the current one marked, and the course's progress.
 */
export function LessonOutline({ view, onNavigate }: { view: LessonView; onNavigate?: () => void }) {
  const done = view.outline.filter((lesson) => lesson.status === "completed").length;
  return (
    <nav aria-label="Lessons in this course" className="grid gap-4">
      <div className="grid gap-2 px-1">
        <p className="font-extrabold leading-snug">{view.course.title}</p>
        <Progress
          value={done}
          max={Math.max(1, view.outline.length)}
          label="Course progress"
          valueText={`${done} of ${view.outline.length} lessons done`}
          tone="success"
        />
        <p className="text-caption font-bold text-fg-muted">
          {done} of {view.outline.length} lessons done · {percentComplete(done, view.outline.length)}%
        </p>
      </div>
      <ol className="grid gap-1">
        {view.outline.map((lesson) => {
          const current = lesson.id === view.lesson.id;
          const Icon = lesson.status === "completed" ? CheckCircle2 : lesson.status === "started" ? CircleDot : Circle;
          return (
            <li key={lesson.id}>
              <Link
                href={`/learn/courses/${view.course.slug}/lessons/${lesson.slug}`}
                aria-current={current ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-start gap-3 rounded-control border-2 px-3 py-2 text-small transition-colors duration-fast",
                  current ? "border-line bg-accent font-bold text-accent-fg shadow-sticker" : "border-transparent hover:bg-surface-sunken",
                )}
              >
                <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", lesson.status === "completed" && !current && "text-success")} />
                <span className="grid min-w-0 flex-1">
                  <span className="wrap-break-word">
                    {lesson.position}. {lesson.title}
                  </span>
                  <span className={cn("text-caption", current ? "text-accent-fg" : "text-fg-muted")}>
                    {lesson.duration_minutes ? `${lesson.duration_minutes} min · ` : ""}
                    {statusLabel[lesson.status]}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
