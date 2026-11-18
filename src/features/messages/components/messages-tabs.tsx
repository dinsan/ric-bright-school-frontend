"use client";

import { Megaphone, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useUnreadCounts } from "../hooks";

/** Parents: their messages and their children's class announcements, with what's unread on each. */
export function MessagesTabs() {
  const pathname = usePathname();
  const unread = useUnreadCounts(true).data;
  const tabs = [
    { href: "/family/messages", label: "Messages", icon: MessageSquare, count: unread?.messages ?? 0 },
    { href: "/family/messages/announcements", label: "Announcements", icon: Megaphone, count: unread?.announcements ?? 0 },
  ];
  return (
    <nav aria-label="Messages and announcements">
      <ul className="flex flex-wrap gap-2">
        {tabs.map(({ href, label, icon: Icon, count }) => {
          const current = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-control items-center gap-2 rounded-control border-2 px-4 font-bold",
                  current ? "border-line bg-accent text-accent-fg shadow-sticker" : "border-line-subtle bg-surface hover:bg-surface-sunken",
                )}
              >
                <Icon aria-hidden className="size-icon" />
                {label}
                {count > 0 && (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full border-2 border-line bg-surface px-1.5 text-caption tabular-nums text-fg">
                    {count}
                    {" "}<span className="sr-only">unread</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
