"use client";

import { Book, Clock, Flame, Library, Lock, Medal, PencilLine, Sprout, Star, Trophy, Zap, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { formatDate, pluralize } from "@/lib/format";
import type { BadgeIcon } from "../badges";
import type { Badge, LearningSummary } from "../contract";
import { useBadges } from "../hooks";
import { usePlayful } from "./celebration";

/**
 * Gamification (FE-STU-07): streak, XP and level, badges. Encouraging, never competitive: there are no
 * rankings against other children, and a broken streak just starts again. Younger grades (and students
 * who keep celebrations on) get the warmer version; the information is the same for everyone.
 */

export const badgeIcons: Record<BadgeIcon, LucideIcon> = {
  sprout: Sprout,
  book: Book,
  books: Library,
  trophy: Trophy,
  medal: Medal,
  flame: Flame,
  zap: Zap,
  clock: Clock,
  star: Star,
  pencil: PencilLine,
};

/** The streak flame: lit while the streak is alive, with the best streak so far. */
export function StreakCard({ summary }: { summary: LearningSummary }) {
  const playful = usePlayful();
  const lit = summary.streak_days > 0;
  return (
    <Card className="h-full gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-line",
            lit ? "bg-accent text-accent-fg" : "bg-surface-sunken text-fg-muted",
            lit && playful && "animate-celebrate",
          )}
        >
          <Flame className="size-6" />
        </span>
        <div>
          <CardTitle as="h2">{lit ? `${pluralize(summary.streak_days, "day")} in a row` : "Start a streak"}</CardTitle>
          <p className="text-small text-fg-muted">
            {lit ? "Learn something today to keep it going." : "Finish or open a lesson today."}
            {summary.longest_streak_days > 1 && ` Best: ${pluralize(summary.longest_streak_days, "day")}.`}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Level and XP, with how far it is to the next level. */
export function LevelCard({ summary }: { summary: LearningSummary }) {
  const { level, xp_into_level, xp_for_next_level } = summary.level;
  return (
    <Card className="h-full gap-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-line bg-primary text-lead font-black text-primary-fg">
          {level}
        </span>
        <div>
          <CardTitle as="h2">Level {level}</CardTitle>
          <p className="text-small text-fg-muted">{summary.xp} XP in all</p>
        </div>
      </div>
      <Progress
        value={xp_into_level}
        max={xp_for_next_level}
        label={`XP to level ${level + 1}`}
        valueText={`${xp_into_level} of ${xp_for_next_level} XP`}
        showLabel
        tone="success"
      />
    </Card>
  );
}

/** Lessons, minutes and courses, in plain numbers. */
export function LearningNumbers({ summary }: { summary: LearningSummary }) {
  const items = [
    { label: "Lessons done", value: summary.lessons_completed },
    { label: "Minutes this week", value: summary.minutes_last_7_days },
    { label: "Courses finished", value: summary.courses_completed },
  ];
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-card border-2 border-line bg-surface p-3 text-center">
          <dt className="text-caption font-bold text-fg-muted">{item.label}</dt>
          <dd className="text-title font-black tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The badge shelf: earned badges in colour with their date, the rest locked with what earns them (so
 * every badge says how to get it).
 */
export function BadgeShelf({ badges, limit }: { badges: Badge[]; limit?: number }) {
  const ordered = [...badges].sort((a, b) => Number(Boolean(b.earned_at)) - Number(Boolean(a.earned_at)));
  const shown = limit ? ordered.slice(0, limit) : ordered;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {shown.map((badge) => {
        const Icon = badgeIcons[badge.icon];
        const earned = Boolean(badge.earned_at);
        return (
          <li key={badge.id} className={cn("grid h-full justify-items-center gap-2 rounded-card border-2 p-4 text-center", earned ? "border-line bg-surface shadow-sticker" : "border-dashed border-line-subtle bg-surface-sunken")}>
            <span
              aria-hidden
              className={cn(
                "relative inline-flex size-14 items-center justify-center rounded-full border-2",
                earned ? "border-line bg-accent text-accent-fg" : "border-line-subtle bg-surface text-fg-muted",
              )}
            >
              <Icon className="size-7" />
              {!earned && <Lock className="absolute -right-1 -bottom-1 size-5 rounded-full border-2 border-line-subtle bg-surface p-0.5" />}
            </span>
            <p className="font-bold leading-snug">
              {badge.name}
              <span className="sr-only">{earned ? ", earned" : ", not earned yet"}</span>
            </p>
            <p className="text-caption text-fg-muted">{badge.description}</p>
            {earned && <p className="text-caption font-bold">Earned {formatDate(badge.earned_at!)}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** /learn/badges: the whole shelf, with its loading, error and empty-history states. */
export function BadgesOverview() {
  const badges = useBadges();
  if (badges.isPending) return <Skeleton className="h-72 w-full" />;
  if (badges.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="Your badges didn't load"
        description={badges.error.message}
        action={<Button onClick={() => badges.refetch()}>Try again</Button>}
      />
    );
  }
  const earned = badges.data.filter((badge) => badge.earned_at).length;
  return (
    <div className="grid gap-4">
      <p className="text-lead" aria-live="polite">
        {earned === 0 ? "No badges yet: finish your first lesson to earn one." : `You have earned ${earned} of ${badges.data.length} badges.`}
      </p>
      <BadgeShelf badges={badges.data} />
    </div>
  );
}
