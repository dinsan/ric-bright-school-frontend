import {
  BookMarked,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe2,
  Landmark,
  Languages,
  Laptop,
  Palette,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { pluralize } from "@/lib/format";
import type { SubjectSummary } from "@/server/catalog/service";

/** An icon per subject slug; new subjects get the book until one is chosen here. */
const subjectIcons: Record<string, LucideIcon> = {
  mathematics: Calculator,
  "reading-writing": BookOpen,
  science: FlaskConical,
  history: Landmark,
  geography: Globe2,
  computing: Laptop,
  "art-design": Palette,
  languages: Languages,
};

function gradeRange(min: number, max: number) {
  return min === max ? `Grade ${min}` : `Grades ${min} to ${max}`;
}

/** Every subject with published courses: how many, for which grades, and a link to them. */
export function SubjectOverview({ subjects }: { subjects: SubjectSummary[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {subjects.map((subject) => {
        const Icon = subjectIcons[subject.slug] ?? BookMarked;
        return (
          <li key={subject.id}>
            <Card asChild interactive className="h-full gap-3">
              <Link href={`/subjects/${encodeURIComponent(subject.slug)}`}>
                <span className="inline-flex size-12 items-center justify-center rounded-control border-2 border-line bg-accent text-accent-fg">
                  <Icon aria-hidden className="size-6" />
                </span>
                <CardTitle>{subject.name}</CardTitle>
                {subject.description && <CardDescription>{subject.description}</CardDescription>}
                <p className="mt-auto text-small font-bold">
                  {pluralize(subject.course_count, "course")} · {gradeRange(subject.min_grade, subject.max_grade)}
                </p>
              </Link>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
