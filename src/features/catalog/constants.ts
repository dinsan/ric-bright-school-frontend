import type { GradeBandId } from "@/lib/preferences";

export const MIN_GRADE = 1;
export const MAX_GRADE = 12;
export const GRADES: readonly number[] = Array.from(
  { length: MAX_GRADE - MIN_GRADE + 1 },
  (_, index) => MIN_GRADE + index,
);

export const PAGE_SIZE = 12;

export interface GradeBand {
  id: GradeBandId;
  label: string;
  /** Inclusive grade range. */
  from: number;
  to: number;
  /** Full Tailwind class strings (must be literal so the compiler can see them). */
  tile: string;
  swatch: string;
}

const ELEMENTARY: GradeBand = {
  id: "elementary",
  label: "Elementary",
  from: 1,
  to: 5,
  tile: "bg-band-elementary text-band-elementary-fg",
  swatch: "bg-band-elementary",
};

export const GRADE_BANDS: readonly GradeBand[] = [
  ELEMENTARY,
  { id: "middle", label: "Middle school", from: 6, to: 8, tile: "bg-band-middle text-band-middle-fg", swatch: "bg-band-middle" },
  { id: "high", label: "High school", from: 9, to: 12, tile: "bg-band-high text-band-high-fg", swatch: "bg-band-high" },
];

export function bandForGrade(grade: number): GradeBand {
  return GRADE_BANDS.find((band) => grade >= band.from && grade <= band.to) ?? ELEMENTARY;
}
