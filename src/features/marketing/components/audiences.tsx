import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

const audiences = [
  {
    id: "parents",
    title: "For parents and guardians",
    points: [
      "Make an account for each child in a minute. Children don't need an email address.",
      "Choose how each child signs in: a password, or three secret pictures for the youngest.",
      "Already have a school account? Link it with a one-time code your child makes.",
      "Switch between your children from the top of the page.",
    ],
    cta: { href: "/sign-up?role=parent", label: "Create a parent account" },
  },
  {
    id: "teachers",
    title: "For teachers",
    points: [
      "Courses for every grade, organised by subject, to plan from.",
      "Young pupils sign in on classroom devices with a class code and three pictures.",
      "Verified teacher accounts, so families know who you are.",
      "Two-step verification to protect your pupils' information.",
    ],
    note: "Coming next: your classes, assignments and a gradebook.",
    cta: { href: "/sign-up?role=teacher", label: "Create a teacher account" },
  },
];

export function Audiences() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {audiences.map((audience) => (
        <Card key={audience.id} className="gap-5">
          <CardTitle className="text-heading">{audience.title}</CardTitle>
          <ul className="grid gap-3">
            {audience.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <Check aria-hidden className="mt-1 size-5 shrink-0 text-success" strokeWidth={3} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {audience.note && <p className="text-small text-fg-muted">{audience.note}</p>}
          <div className="mt-auto">
            <ButtonLink href={audience.cta.href} variant="primary">
              {audience.cta.label}
            </ButtonLink>
          </div>
        </Card>
      ))}
    </div>
  );
}
