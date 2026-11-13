import { BookOpenCheck, MousePointerClick, Sparkles, type LucideIcon } from "lucide-react";

const steps: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: MousePointerClick,
    title: "Pick a grade",
    body: "Every course is for one grade, from 1 to 12, and sorted by subject. Start with your grade, or search by title.",
  },
  {
    icon: BookOpenCheck,
    title: "Learn in small steps",
    body: "Each lesson explains one idea, then asks you to try it, with feedback straight away. Try the sample below.",
  },
  {
    icon: Sparkles,
    title: "Made for every age",
    body: "Parents set up their children's accounts, and young children sign in with pictures. Text size and spacing fit each age group.",
  },
];

export function HowItWorks() {
  return (
    <ol className="grid gap-6 md:grid-cols-3">
      {steps.map(({ icon: Icon, title, body }, index) => (
        <li key={title} className="grid content-start gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full border-2 border-line bg-primary text-lead font-black text-primary-fg">
              {index + 1}
            </span>
            <Icon aria-hidden className="size-7" />
          </div>
          <h3 className="text-heading">{title}</h3>
          <p className="text-fg-muted">{body}</p>
        </li>
      ))}
    </ol>
  );
}
