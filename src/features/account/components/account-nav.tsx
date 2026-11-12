"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/account", label: "Profile" },
  { href: "/account/security", label: "Sign-in and security" },
];

/** Tabs between the account pages (they are links: each page has its own URL). */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="mb-6">
      <ul className="flex max-w-full gap-1 overflow-x-auto rounded-control border-2 border-line bg-surface-sunken p-1 sm:w-fit">
        {TABS.map((tab) => {
          const current = pathname === tab.href;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-control-sm items-center rounded-[calc(var(--control-radius)*0.7)] px-3 text-small font-bold",
                  current ? "bg-surface text-fg shadow-[inset_0_0_0_2px_var(--line)]" : "text-fg-muted hover:text-fg",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
