"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/cn";

interface AppNavProps {
  items: NavItem[];
  /** Which item is current. Defaults to the best match for the current URL. */
  activeHref?: string;
  onNavigate?: () => void;
}

export function bestMatch(items: NavItem[], pathname: string) {
  // The longest path that matches, so "/learn/courses" beats "/learn". An item also matches its `match` paths.
  const within = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return items
    .flatMap((item) => [item.href, ...(item.match ?? [])].filter(within).map((path) => ({ href: item.href, length: path.length })))
    .sort((a, b) => b.length - a.length)[0]?.href;
}

export function AppNav({ items, activeHref, onNavigate }: AppNavProps) {
  const pathname = usePathname();
  const current = activeHref ?? bestMatch(items, pathname);
  return (
    <ul className="grid gap-1">
      {items.map(({ label, href, icon: Icon }) => {
        const active = href === current;
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-control items-center gap-3 rounded-control border-2 px-3 font-bold transition-colors duration-fast",
                active ? "border-line bg-accent text-accent-fg shadow-sticker" : "border-transparent text-fg hover:bg-surface-sunken",
              )}
            >
              <Icon aria-hidden className="size-icon shrink-0" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
