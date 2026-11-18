"use client";

import { Award, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const tabs = [
  { href: "/learn/badges", label: "Badges", icon: Award },
  { href: "/learn/certificates", label: "Certificates", icon: ScrollText },
];

/** Achievements = badges + certificates: one sidebar item, two pages, switched here. */
export function AchievementsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Achievements">
      <ul className="flex flex-wrap gap-2">
        {tabs.map(({ href, label, icon: Icon }) => {
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
