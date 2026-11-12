"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  /** Hide from assistive technology when the name is already given nearby (for example in a button label). */
  decorative?: boolean;
  className?: string;
}

const sizes = { sm: "size-8 text-caption", md: "size-10 text-small", lg: "size-16 text-lead" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part?.[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Profile picture with initials while it loads or when there is none. */
export function Avatar({ name, src, size = "md", decorative = false, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-accent font-bold text-accent-fg select-none",
        sizes[size],
        className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt={decorative ? "" : name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback delayMs={src ? 400 : 0}>
        <span aria-hidden>{initials(name)}</span>
        {!decorative && <span className="sr-only">{name}</span>}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
