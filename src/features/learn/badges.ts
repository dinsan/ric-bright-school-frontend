/**
 * Badges (FE-STU-07, BE-LRN-05): what can be earned and what earns it. Defined in code, so every
 * student sees the same shelf; the database only records who earned what and when (student_badges).
 *
 * Badges reward steady learning, never speed or ranking against other children: there are no
 * leaderboards, and nothing is lost for a missed day except the streak counter itself.
 *
 * Pure (no DOM, React or database): the server decides, the browser shows.
 */

export interface LearningStats {
  lessons_completed: number;
  courses_completed: number;
  /** The current streak, in days. */
  streak_days: number;
  /** All learning time, in minutes. */
  minutes_total: number;
  /** Notes written in lessons (FE-STU-06). */
  notes_written: number;
}

export type BadgeIcon = "sprout" | "book" | "books" | "trophy" | "medal" | "flame" | "zap" | "clock" | "star" | "pencil";

export interface BadgeDefinition {
  id: string;
  name: string;
  /** What it is for, in words a Grade 1 reader can follow. */
  description: string;
  icon: BadgeIcon;
  earned: (stats: LearningStats) => boolean;
}

export const BADGES: readonly BadgeDefinition[] = [
  { id: "first-lesson", name: "First step", description: "Finish your first lesson.", icon: "sprout", earned: (s) => s.lessons_completed >= 1 },
  { id: "ten-lessons", name: "Busy learner", description: "Finish 10 lessons.", icon: "book", earned: (s) => s.lessons_completed >= 10 },
  { id: "fifty-lessons", name: "Bookworm", description: "Finish 50 lessons.", icon: "books", earned: (s) => s.lessons_completed >= 50 },
  { id: "first-course", name: "Course champion", description: "Finish every lesson of a course.", icon: "trophy", earned: (s) => s.courses_completed >= 1 },
  { id: "three-courses", name: "Explorer", description: "Finish three courses.", icon: "medal", earned: (s) => s.courses_completed >= 3 },
  { id: "streak-3", name: "On a roll", description: "Learn three days in a row.", icon: "flame", earned: (s) => s.streak_days >= 3 },
  { id: "streak-7", name: "Week of learning", description: "Learn seven days in a row.", icon: "zap", earned: (s) => s.streak_days >= 7 },
  { id: "hour-of-learning", name: "Hour of learning", description: "Spend an hour learning, all together.", icon: "clock", earned: (s) => s.minutes_total >= 60 },
  { id: "ten-hours", name: "Deep diver", description: "Spend ten hours learning, all together.", icon: "star", earned: (s) => s.minutes_total >= 600 },
  { id: "note-taker", name: "Note taker", description: "Write 5 notes in your lessons.", icon: "pencil", earned: (s) => s.notes_written >= 5 },
];

export const BADGE_IDS = BADGES.map((badge) => badge.id);

export function badgeById(id: string): BadgeDefinition | undefined {
  return BADGES.find((badge) => badge.id === id);
}

/** The badges these stats earn that the student doesn't have yet, in shelf order. */
export function newlyEarnedBadges(stats: LearningStats, alreadyEarned: Iterable<string>): BadgeDefinition[] {
  const have = new Set(alreadyEarned);
  return BADGES.filter((badge) => !have.has(badge.id) && badge.earned(stats));
}
