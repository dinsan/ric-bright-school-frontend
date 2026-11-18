"use client";

import { ChartLine, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** A child's two pages for their parent: progress, and parental controls. */
export function ChildNav({ childId, name }: { childId: string; name: string }) {
  const pathname = usePathname();
  const base = `/family/children/${childId}`;
  const tabs = [
    { href: base, label: "Progress", icon: ChartLine },
    { href: `${base}/controls`, label: "Parental controls", icon: ShieldCheck },
  ];
  return (
    <nav aria-label={`${name}'s pages`}>
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
