"use client";

import { Check } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** A menu of actions or options opened from a button. Arrow keys move, typing jumps to an item. */
export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-popover min-w-48 overflow-hidden rounded-card border-2 border-line bg-surface p-1.5 text-fg shadow-sticker",
          "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

const itemClass =
  "relative flex min-h-control-sm cursor-pointer items-center gap-2.5 rounded-[calc(var(--control-radius)*0.7)] px-2.5 text-body outline-none select-none " +
  "data-[highlighted]:bg-surface-sunken data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-icon [&_svg]:shrink-0";

export function DropdownMenuItem({
  className,
  tone = "default",
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & { tone?: "default" | "danger" }) {
  return <MenuPrimitive.Item className={cn(itemClass, tone === "danger" && "text-danger-text", className)} {...props} />;
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(itemClass, "pr-9", className)} {...props}>
      {children}
      <MenuPrimitive.ItemIndicator className="absolute right-2.5 inline-flex">
        <Check aria-hidden />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem className={cn(itemClass, "pr-9", className)} {...props}>
      {children}
      <MenuPrimitive.ItemIndicator className="absolute right-2.5 inline-flex">
        <Check aria-hidden />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-2.5 pt-1.5 pb-1 text-caption font-bold text-fg-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("-mx-1.5 my-1.5 h-0.5 bg-line-subtle", className)} {...props} />;
}
