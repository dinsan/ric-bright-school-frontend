import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export interface FaqItem {
  question: string;
  answer: ReactNode;
}

const link = "font-bold text-link underline underline-offset-4";

export const faqItems: FaqItem[] = [
  {
    question: "Which grades is Lumina for?",
    answer: (
      <>
        Grades 1 to 12. Every course is for one grade, so you can start with yours on the{" "}
        <Link href="/courses" className={link}>courses page</Link>. Text size and spacing adapt to three age groups:
        Grades 1–5, 6–8 and 9–12.
      </>
    ),
  },
  {
    question: "Does my child need an email address?",
    answer:
      "No. A parent or the school makes the account. Your child signs in with a username and a password, or with a class code and three secret pictures.",
  },
  {
    question: "How do young children sign in?",
    answer:
      "On a classroom device, the teacher enters a class code. Each child taps their name, then their three secret pictures in order. After five wrong tries, sign-in pauses and the child is asked to get their teacher.",
  },
  {
    question: "Are there adverts, or is my child's data sold?",
    answer: (
      <>
        Neither, ever. Lumina has no adverts, no tracking cookies and no analytics, and never sells personal information.
        Our <Link href="/privacy" className={link}>privacy policy</Link> lists everything we keep.
      </>
    ),
  },
  {
    question: "Can children talk to strangers on Lumina?",
    answer: (
      <>
        No. There is no chat and there are no public profiles. Read more about{" "}
        <Link href="/safety" className={link}>how we keep children safe</Link>.
      </>
    ),
  },
  {
    question: "My child already has a school account. Can I see it?",
    answer:
      "Yes. Your child makes a one-time code under Account, then Connect a parent. Type it under My children, then Link a student account.",
  },
  {
    question: "How do teachers get verified?",
    answer:
      "Sign up as a teacher and complete your teacher profile (school, subjects and grades). A Lumina admin checks it and verifies your account.",
  },
  {
    question: "Can I delete my account?",
    answer: (
      <>
        Yes, any time, under Your account. It is deleted straight away. To delete a child&apos;s account, email us from the{" "}
        <Link href="/contact" className={link}>contact page</Link>.
      </>
    ),
  },
];

/** Questions and answers as native disclosure widgets: keyboard and screen-reader friendly, no script needed. */
export function Faq({ items = faqItems }: { items?: FaqItem[] }) {
  return (
    <div className="grid max-w-3xl gap-3">
      {items.map((item) => (
        <details key={item.question} className="group rounded-card border-2 border-line bg-surface shadow-sticker">
          <summary className="flex min-h-control cursor-pointer list-none items-center justify-between gap-4 rounded-card px-card py-3 text-lead font-bold [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown aria-hidden className="size-icon shrink-0 transition-transform duration-fast group-open:rotate-180" />
          </summary>
          <div className="px-card pb-card text-fg-muted">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
