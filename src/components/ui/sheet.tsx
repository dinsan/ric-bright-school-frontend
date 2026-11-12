"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CloseButton, DialogOverlay } from "./dialog";

/** A panel that slides in from an edge: the mobile navigation drawer, filters, details. */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const sides = {
  left: "inset-y-0 left-0 h-full w-[min(20rem,calc(100%-3rem))] border-r-2 data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left",
  right:
    "inset-y-0 right-0 h-full w-[min(24rem,calc(100%-3rem))] border-l-2 data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-card border-t-2 data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom",
};

export interface SheetContentProps extends Omit<ComponentProps<typeof SheetPrimitive.Content>, "title"> {
  /** Required: names the panel for screen readers. */
  title: ReactNode;
  description?: ReactNode;
  side?: keyof typeof sides;
  /** Show the title visually (default) or only to screen readers. */
  hideTitle?: boolean;
}

export function SheetContent({ title, description, side = "left", hideTitle, className, children, ...props }: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <DialogOverlay />
      <SheetPrimitive.Content
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed z-modal flex flex-col gap-4 overflow-y-auto border-line bg-surface p-card text-fg shadow-sticker-lg",
          sides[side],
          className,
        )}
        {...props}
      >
        <div className={cn("flex items-start justify-between gap-4", hideTitle && "justify-end")}>
          <div className={cn("grid gap-1 pt-1", hideTitle && "sr-only")}>
            <SheetPrimitive.Title className="text-heading">{title}</SheetPrimitive.Title>
            {description && (
              <SheetPrimitive.Description className="text-small text-fg-muted">{description}</SheetPrimitive.Description>
            )}
          </div>
          <CloseButton />
        </div>
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
