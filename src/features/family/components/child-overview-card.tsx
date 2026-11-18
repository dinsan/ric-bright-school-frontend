import { ArrowRight, BookOpenCheck, ClipboardList, Clock, Flame, ShieldCheck, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardFooter, CardTitle } from "@/components/ui/card";
import { hasControls } from "@/features/learn/controls";
import type { ChildOverview } from "../contract";
import { shortMinutes } from "../format";
import { lastActiveLabel, scoreText } from "../insights";

export const childHref = (childId: string) => `/family/children/${childId}`;

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid gap-0.5 rounded-control border-2 border-line-subtle bg-surface-sunken px-3 py-2">
      <dt className="flex items-center gap-1.5 text-caption font-bold text-fg-muted [&_svg]:size-4">
        {icon}
        {label}
      </dt>
      <dd className="text-lead font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * One child on the parent's dashboard (FE-PAR-01): when they last learned, this week's time, streak,
 * lessons and courses, the latest quiz, work due, and whether controls are on. Links to their page.
 */
export function ChildOverviewCard({ card, now, timeZone }: { card: ChildOverview; now: Date; timeZone: string | null }) {
  const { child } = card;
  const first = child.display_name.split(" ")[0];
  const headingId = `child-${child.id}`;
  return (
    <Card className="h-full" aria-labelledby={headingId} role="group">
      <div className="flex items-center gap-3">
        <Avatar name={child.display_name} size="lg" decorative />
        <div className="grid min-w-0">
          <CardTitle as="h2" id={headingId}>
            {child.display_name}
          </CardTitle>
          <span className="text-small text-fg-muted">
            {child.grade_level ? `Grade ${child.grade_level}` : "Grade not set"} · {lastActiveLabel(card.last_active_at, now, timeZone)}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Stat icon={<Clock aria-hidden />} label="Last 7 days" value={shortMinutes(card.minutes_last_7_days)} />
        <Stat icon={<Flame aria-hidden />} label="Streak" value={`${card.streak_days} ${card.streak_days === 1 ? "day" : "days"}`} />
        <Stat icon={<BookOpenCheck aria-hidden />} label="Lessons done" value={String(card.lessons_completed)} />
        <Stat icon={<Trophy aria-hidden />} label="Courses" value={`${card.courses_in_progress} going · ${card.courses_completed} done`} />
      </dl>

      <ul className="grid gap-2 text-small">
        <li>
          <span className="font-bold">Latest quiz: </span>
          {card.latest_quiz ? `${card.latest_quiz.quiz}, ${scoreText(card.latest_quiz)}` : "none yet"}
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <ClipboardList aria-hidden className="size-4 shrink-0" />
          <span className="font-bold">School work:</span>
          {card.work.overdue === 0 && card.work.due_soon === 0 ? (
            <span>nothing due this week</span>
          ) : (
            <>
              {card.work.overdue > 0 && <Badge tone="danger">{card.work.overdue} overdue</Badge>}
              {card.work.due_soon > 0 && <Badge tone="warning">{card.work.due_soon} due this week</Badge>}
            </>
          )}
        </li>
        {hasControls(card.controls) && (
          <li className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-4 shrink-0" />
            <span>
              Controls on
              {card.controls.daily_minutes !== null && ` · ${card.controls.daily_minutes} min a day`}
              {card.controls.bedtime && ` · bedtime ${card.controls.bedtime.start}–${card.controls.bedtime.end}`}
            </span>
          </li>
        )}
      </ul>

      <CardFooter className="mt-auto">
        <ButtonLink href={childHref(child.id)} variant="primary">
          See {first}&apos;s progress
          <ArrowRight aria-hidden />
        </ButtonLink>
      </CardFooter>
    </Card>
  );
}
