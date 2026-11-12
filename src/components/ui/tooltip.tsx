"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: ReactNode;
  /** One focusable element (a Button, a link). */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

/**
 * A short hint on hover and keyboard focus. Never put essential information in a tooltip:
 * touch screens (most young learners) cannot hover. Icon-only buttons still need an aria-label.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-tooltip max-w-64 rounded-control bg-inverse px-3 py-1.5 text-small font-medium text-inverse-fg",
            "data-[state=delayed-open]:animate-fade-in data-[state=closed]:animate-fade-out",
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-inverse" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
