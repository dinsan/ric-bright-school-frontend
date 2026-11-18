import {
  Award,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  CirclePlay,
  ClipboardCheck,
  Clock,
  Flame,
  GraduationCap,
  ScrollText,
  ShieldCheck,
  Sprout,
  Star,
  Target,
  ThumbsUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { describeControls, formatMinutes } from "@/features/learn/controls";
import type { ActivityKind, ChildProgress } from "../contract";
import { dayParts, formatDateTime, formatDay, shortMinutes } from "../format";
import { scoreText } from "../insights";

/**
 * A child's page for their parent (FE-PAR-02): the numbers, doing well and worth practising, courses,
 * quiz results (grades), work set by teachers, learning time per day, recent activity, badges and
 * certificates, and the controls in force. Server-rendered: no JavaScript needed to read it.
 */
export function ChildProgressView({ progress, timeZone, controlsHref }: { progress: ChildProgress; timeZone: string | null; controlsHref: string }) {
  const { summary, period } = progress;
  const first = progress.child.display_name.split(" ")[0]!;
  return (
    <div className="grid gap-8">
      <section aria-labelledby="numbers-heading" className="grid gap-3">
        <h2 id="numbers-heading" className="sr-only">
          In numbers
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile icon={Clock} label={`Time in lessons, last ${period.days} days`} value={shortMinutes(period.minutes)} note={`on ${period.active_days} ${period.active_days === 1 ? "day" : "days"}`} />
          <Tile icon={Flame} label="Streak" value={`${summary.streak_days} ${summary.streak_days === 1 ? "day" : "days"}`} note={`longest ${summary.longest_streak_days}`} />
          <Tile icon={BookOpenCheck} label="Lessons finished" value={String(summary.lessons_completed)} note={`${period.lessons_completed} in the last ${period.days} days`} />
          <Tile
            icon={Target}
            label="Quiz average"
            value={summary.quiz_average_percent === null ? "–" : `${summary.quiz_average_percent}%`}
            note={summary.quiz_average_percent === null ? "no quizzes yet" : `latest try of each quiz`}
          />
          <Tile icon={Trophy} label="Courses finished" value={String(summary.courses_completed)} note={`${progress.courses.filter((course) => !course.completed_at).length} in progress`} />
          <Tile icon={Star} label="Level" value={String(summary.level)} note={`${summary.xp} XP`} />
          <Tile icon={Award} label="Badges" value={String(summary.badges_earned)} note={`${progress.certificates.length} ${progress.certificates.length === 1 ? "certificate" : "certificates"}`} />
          <Tile icon={Clock} label="All learning time" value={shortMinutes(summary.minutes_total)} note="in lessons, since the start" />
        </dl>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <InsightCard title="Doing well" icon={ThumbsUp} items={progress.insights.doing_well} empty={`Nothing to point out yet. As ${first} finishes lessons and quizzes, this fills up.`} tone="success" />
        <InsightCard title="Worth practising" icon={Sprout} items={progress.insights.to_practise} empty="Nothing stands out. Keep going!" tone="warning" />
      </div>

      <Section id="courses" title="Courses" icon={BookOpen}>
        {progress.courses.length === 0 ? (
          <Empty>{first} hasn&apos;t started a course yet.</Empty>
        ) : (
          <ul className="grid gap-3">
            {progress.courses.map((course) => (
              <li key={course.id} className="grid gap-2 rounded-card border-2 border-line-subtle bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="grid min-w-0">
                    <span className="font-bold wrap-break-word">{course.title}</span>
                    <span className="text-small text-fg-muted">
                      {course.subject} · Grade {course.grade_level} · last active {formatDay(course.last_activity_at, timeZone)}
                    </span>
                  </div>
                  {course.completed_at ? <Badge tone="success">Finished {formatDay(course.completed_at, timeZone)}</Badge> : <Badge tone="info">In progress</Badge>}
                </div>
                <p className="text-small font-bold tabular-nums" aria-hidden>
                  {course.lessons_completed} of {course.lessons_total} lessons · {course.percent}%
                </p>
                {/* The course name is the bar's name for screen readers; on screen it is the line above. */}
                <Progress
                  value={course.lessons_completed}
                  max={Math.max(1, course.lessons_total)}
                  label={`${course.title} progress`}
                  valueText={`${course.lessons_completed} of ${course.lessons_total} lessons · ${course.percent}%`}
                  tone="success"
                />
                {course.next_lesson && <p className="text-small">Next lesson: {course.next_lesson}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="quizzes" title="Quiz results" icon={GraduationCap} description="The latest try of each quiz. Written answers aren't marked automatically, so they aren't in the score.">
        {progress.quizzes.length === 0 ? (
          <Empty>No quizzes taken yet.</Empty>
        ) : (
          <ul className="grid gap-2">
            {progress.quizzes.map((row) => (
              <li key={`${row.quiz}-${row.started_at}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card border-2 border-line-subtle bg-surface px-4 py-3">
                <span className="grid min-w-0">
                  <span className="font-bold wrap-break-word">{row.quiz}</span>
                  <span className="text-small text-fg-muted">
                    {row.course} · {row.status === "submitted" && row.submitted_at ? `finished ${formatDateTime(row.submitted_at, timeZone)}` : `started ${formatDateTime(row.started_at, timeZone)}`}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {row.percent !== null && <Badge tone={scoreTone(row.percent)}>{row.percent}%</Badge>}
                  <span className="text-small font-bold">{row.percent !== null ? `${row.score} of ${row.max_score} points` : scoreText(row)}</span>
                  {row.status === "submitted" && row.pending_review > 0 && <span className="text-small text-fg-muted">+ {row.pending_review} written, not marked</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="work" title="Work set by teachers" icon={ClipboardCheck}>
        {progress.assignments.length === 0 ? (
          <Empty>No work set by a teacher. Work appears here when {first}&apos;s class teacher sets it.</Empty>
        ) : (
          <ul className="grid gap-2">
            {progress.assignments.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card border-2 border-line-subtle bg-surface px-4 py-3">
                <span className="grid min-w-0">
                  <span className="font-bold wrap-break-word">{row.title}</span>
                  <span className="text-small text-fg-muted">
                    {row.lesson ? `Lesson “${row.lesson}”` : `The whole course “${row.course}”`} · {row.class_name}, {row.teacher_name}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={dueTone[row.due_tone]}>{row.due_label}</Badge>
                  <span className="text-small font-bold">
                    {workStatus[row.status]}
                    {row.lessons_total > 1 && ` (${row.lessons_done} of ${row.lessons_total} lessons)`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="time" title="Learning time" icon={CalendarClock} description={`Time spent in lessons each day, last ${period.days} days.`}>
        <LearningChart days={progress.learning_days} />
        <p className="text-small">
          {period.minutes ? `${formatMinutes(period.minutes)} in ${period.days} days, on ${period.active_days} ${period.active_days === 1 ? "day" : "days"}.` : `No time in lessons in the last ${period.days} days.`}
        </p>
      </Section>

      <Section id="activity" title="Recent activity" icon={CirclePlay}>
        {progress.activity.length === 0 ? (
          <Empty>Nothing yet. Lessons, quizzes, badges and certificates appear here as {first} learns.</Empty>
        ) : (
          <ol className="grid gap-0">
            {progress.activity.map((item, index) => {
              const Icon = activityIcon[item.kind];
              return (
                <li key={`${item.at}-${index}`} className="flex gap-3 border-b-2 border-line-subtle py-2.5 last:border-b-0">
                  <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                  <span className="grid min-w-0">
                    <span className="wrap-break-word">{item.text}</span>
                    <span className="text-small text-fg-muted">
                      <time dateTime={item.at}>{formatDateTime(item.at, timeZone)}</time>
                      {item.course && item.kind !== "course_started" && item.kind !== "certificate" && ` · ${item.course}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section id="achievements" title="Badges and certificates" icon={ScrollText}>
        {progress.badges.length === 0 && progress.certificates.length === 0 ? (
          <Empty>None yet. The first badge comes with the first finished lesson.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {progress.certificates.map((row) => (
              <li key={row.code} className="rounded-card border-2 border-line-subtle bg-surface px-4 py-3">
                <span className="font-bold">Certificate: {row.course}</span>
                <span className="block text-small text-fg-muted">
                  {formatDay(row.issued_at, timeZone)} · {row.code}
                </span>
              </li>
            ))}
            {progress.badges.map((row) => (
              <li key={row.name} className="rounded-card border-2 border-line-subtle bg-surface px-4 py-3">
                <span className="font-bold">Badge: {row.name}</span>
                <span className="block text-small text-fg-muted">
                  {row.description} · {formatDay(row.earned_at, timeZone)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="controls" title="Parental controls" icon={ShieldCheck}>
        <ul className="grid gap-1">
          {describeControls(progress.controls).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>
          <Link href={controlsHref} className="font-bold underline underline-offset-4 hover:no-underline">
            Change {first}&apos;s controls
          </Link>
        </p>
      </Section>
    </div>
  );
}

const dueTone: Record<ChildProgress["assignments"][number]["due_tone"], BadgeTone> = { overdue: "danger", today: "warning", soon: "warning", later: "neutral", done: "success" };
const workStatus = { done: "Done", in_progress: "In progress", not_started: "Not started" } as const;
const scoreTone = (percent: number): BadgeTone => (percent >= 80 ? "success" : percent >= 60 ? "info" : "warning");
const activityIcon: Record<ActivityKind, LucideIcon> = {
  course_started: BookOpen,
  lesson_started: CirclePlay,
  lesson_completed: BookOpenCheck,
  quiz_finished: GraduationCap,
  badge: Award,
  certificate: ScrollText,
};

function Tile({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <div className="grid content-start gap-1 rounded-card border-2 border-line bg-surface p-4">
      <dt className="flex items-start gap-1.5 text-small font-bold text-fg-muted">
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
        {label}
      </dt>
      <dd className="text-heading font-extrabold tabular-nums">{value}</dd>
      <dd className="text-caption text-fg-muted">{note}</dd>
    </div>
  );
}

function Section({ id, title, icon: Icon, description, children }: { id: string; title: string; icon: LucideIcon; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="grid gap-3">
      <div className="grid gap-1">
        <h2 id={`${id}-heading`} className="flex items-center gap-2 text-heading">
          <Icon aria-hidden className="size-6 shrink-0" />
          {title}
        </h2>
        {description && <p className="text-small text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-card border-2 border-dashed border-line-subtle bg-surface px-4 py-3 text-fg-muted">{children}</p>;
}

function InsightCard({ title, icon: Icon, items, empty, tone }: { title: string; icon: LucideIcon; items: string[]; empty: string; tone: "success" | "warning" }) {
  return (
    <Card variant="flat" className={cn("gap-3", tone === "success" ? "bg-success-soft text-success-soft-fg" : "bg-warning-soft text-warning-soft-fg")}>
      <CardTitle as="h2" className="flex items-center gap-2">
        <Icon aria-hidden className="size-5 shrink-0" />
        {title}
      </CardTitle>
      {items.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul className="grid list-disc gap-1.5 pl-5">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Minutes per day as bars. The bars are a picture (hidden from screen readers); the same numbers are in a
 * table that screen readers read, so nothing depends on seeing the chart.
 */
function LearningChart({ days }: { days: ChildProgress["learning_days"] }) {
  const max = Math.max(15, ...days.map((day) => day.minutes));
  return (
    <figure className="grid gap-2">
      <div aria-hidden className="flex h-40 items-end gap-1 rounded-card border-2 border-line bg-surface px-2 pt-3 pb-1 sm:gap-2">
        {days.map((day) => {
          const parts = dayParts(day.day);
          return (
            <div key={day.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              {day.minutes > 0 && <span className="text-[0.65rem] font-bold tabular-nums text-fg-muted">{day.minutes}</span>}
              <div className={cn("w-full max-w-8 rounded-t-sm border-2 border-line", day.minutes ? "bg-primary" : "border-dashed bg-transparent")} style={{ height: `${Math.max(4, (day.minutes / max) * 100)}%` }} />
              <span className="text-[0.65rem] text-fg-muted">{parts.weekday.slice(0, 2)}</span>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>Minutes in lessons per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Minutes</th>
            <th scope="col">Lessons finished</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const parts = dayParts(day.day);
            return (
              <tr key={day.day}>
                <th scope="row">{`${parts.weekday} ${parts.date}`}</th>
                <td>{day.minutes}</td>
                <td>{day.lessons_completed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}
