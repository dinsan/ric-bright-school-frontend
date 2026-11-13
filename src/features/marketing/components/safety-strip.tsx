import { Ban, EyeOff, MessageSquareOff, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";

const promises: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: Ban, title: "No ads", body: "Nothing on Lumina tries to sell to children." },
  { icon: EyeOff, title: "No tracking", body: "No analytics or advertising cookies. We never sell data." },
  { icon: MessageSquareOff, title: "No chat with strangers", body: "No messaging and no public profiles." },
  { icon: ShieldCheck, title: "Parents in charge", body: "Children's accounts come from a parent or school." },
];

export function SafetyStrip() {
  return (
    <div className="grid gap-8">
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {promises.map(({ icon: Icon, title, body }) => (
          <li key={title} className="grid content-start gap-2">
            <Icon aria-hidden className="size-8" />
            <h3 className="text-lead font-extrabold">{title}</h3>
            <p className="text-fg-muted">{body}</p>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap gap-x-6 gap-y-2 font-bold">
        <Link href="/safety" className="text-link underline underline-offset-4">
          How we keep children safe
        </Link>
        <Link href="/privacy" className="text-link underline underline-offset-4">
          Privacy policy, with a version for kids
        </Link>
      </p>
    </div>
  );
}
