import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import type { Course } from "../types";
import { GradeMark } from "./grade-tile";

export function CourseCard({ course }: { course: Course }) {
  return (
    <Card asChild interactive className="group h-full">
      <Link href={`/courses/${course.slug}`}>
        <div className="flex items-center gap-3">
          <GradeMark grade={course.grade_level} className="size-11 text-2xl" />
          <p className="text-small font-bold text-fg-muted">
            <span className="sr-only">Grade {course.grade_level}, </span>
            {course.subject.name}
          </p>
        </div>
        <div>
          <CardTitle className="group-hover:underline group-hover:underline-offset-4">
            {course.title}
          </CardTitle>
          <p className="mt-1.5 text-small text-fg-muted">{course.summary}</p>
        </div>
      </Link>
    </Card>
  );
}
