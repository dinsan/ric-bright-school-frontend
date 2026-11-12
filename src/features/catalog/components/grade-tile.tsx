import { cn } from "@/lib/cn";
import { bandForGrade } from "../constants";

/** A grade number on its band colour. Decorative text; the grade is announced by the parent. */
export function GradeMark({ grade, className }: { grade: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-control border-2 border-line font-black leading-none",
        bandForGrade(grade).tile,
        className,
      )}
    >
      {/* Two digits at the same size touch the border of a square mark, so scale them down. */}
      <span className={cn(grade >= 10 && "text-[0.8em] tracking-tight")}>{grade}</span>
    </span>
  );
}
