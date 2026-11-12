"use client";

import { cn } from "@/lib/cn";
import { GRADES, bandForGrade } from "../constants";

interface GradeFilterProps {
  value: number | undefined;
  onChange: (grade: number | undefined) => void;
}

const chip =
  "flex h-control-sm min-w-control-sm items-center justify-center rounded-control border-2 border-line px-3 text-small font-bold transition-colors duration-fast";

export function GradeFilter({ value, onChange }: GradeFilterProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-small font-bold">Grade</legend>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={value === undefined}
          onClick={() => onChange(undefined)}
          className={cn(chip, value === undefined ? "bg-inverse text-inverse-fg" : "bg-surface hover:bg-surface-sunken")}
        >
          All
        </button>
        {GRADES.map((grade) => (
          <button
            key={grade}
            type="button"
            aria-pressed={value === grade}
            aria-label={`Grade ${grade}`}
            onClick={() => onChange(grade)}
            className={cn(chip, value === grade ? bandForGrade(grade).tile : "bg-surface hover:bg-surface-sunken")}
          >
            {grade}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
