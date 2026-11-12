import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)}>
      <rect x="2" y="2" width="28" height="28" rx="7" className="fill-band-high stroke-line" strokeWidth="2" />
      <circle cx="16" cy="16" r="5.5" className="fill-accent" />
    </svg>
  );
}

/** `compact`: only the mark on small screens (the name is still announced), for crowded top bars. */
export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 text-xl font-black tracking-tight text-fg", className)}>
      <LogoMark />
      <span className={cn(compact && "max-sm:sr-only")}>{siteConfig.name}</span>
    </Link>
  );
}
