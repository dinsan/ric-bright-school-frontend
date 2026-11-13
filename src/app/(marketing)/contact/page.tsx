import { HelpCircle, Lock, ShieldAlert, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { legalConfig } from "@/config/legal";
import { DraftNotice } from "@/features/legal/components/legal-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact us",
  description: "How to reach Lumina: help with an account, privacy and data requests, and reporting a safety concern.",
  path: "/contact",
});

const { contacts, responseTimes } = legalConfig;

const topics: Array<{ icon: LucideIcon; title: string; body: string; email: string; note?: string }> = [
  {
    icon: HelpCircle,
    title: "Help with your account",
    body: "Can't sign in, a child's pictures forgotten, a teacher account to verify, or something not working.",
    email: contacts.support,
  },
  {
    icon: Lock,
    title: "Privacy and your data",
    body: "See, correct, download or delete your information or your child's, or ask about our privacy policy.",
    email: contacts.privacy,
    note: `We answer within ${responseTimes.privacyRequestDays} days.`,
  },
  {
    icon: ShieldAlert,
    title: "Report a safety concern",
    body: "Something on Lumina that isn't right for children, an account you don't recognise, or a security problem.",
    email: contacts.safety,
    note: `We reply within ${responseTimes.safetyReport}. If a child is in danger right now, call your local emergency number.`,
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-gutter py-10 lg:py-14">
      <Breadcrumb className="mb-6" items={[{ label: "Home", href: "/" }, { label: "Contact us" }]} />
      <h1 className="text-title">Contact us</h1>
      <p className="mt-3 max-w-2xl text-lead text-fg-muted">
        Write to the right address and your message reaches the people who can help. Please don&apos;t send passwords or
        children&apos;s pictures by email.
      </p>
      {!legalConfig.reviewed && <DraftNotice className="mt-6 max-w-2xl" />}
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {topics.map(({ icon: Icon, title, body, email, note }) => (
          <li key={title}>
            <Card className="h-full">
              <Icon aria-hidden className="size-8" />
              <CardTitle as="h2">{title}</CardTitle>
              <CardDescription className="text-body">{body}</CardDescription>
              <a href={`mailto:${email}`} className="mt-auto font-bold wrap-break-word text-link underline underline-offset-4">
                {email}
              </a>
              {note && <p className="text-small text-fg-muted">{note}</p>}
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-10 max-w-2xl text-small text-fg-muted">
        By post: {legalConfig.operator}, {legalConfig.postalAddress}. See also our <Link href="/privacy" className="font-bold text-link underline underline-offset-4">privacy policy</Link> and{" "}
        <Link href="/safety" className="font-bold text-link underline underline-offset-4">how we keep children safe</Link>.
      </p>
    </div>
  );
}
