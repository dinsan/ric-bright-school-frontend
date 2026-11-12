"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A modal window. Focus is trapped inside, Escape closes it, and focus returns to the trigger. */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-overlay bg-scrim data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
        className,
      )}
      {...props}
    />
  );
}

/** The close button in the corner of dialogs and sheets. */
export function CloseButton({ label = "Close" }: { label?: string }) {
  return (
    <DialogPrimitive.Close
      aria-label={label}
      className="inline-flex size-control shrink-0 items-center justify-center rounded-control text-fg hover:bg-surface-sunken [&_svg]:size-icon"
    >
      <X aria-hidden />
    </DialogPrimitive.Close>
  );
}

export interface DialogContentProps extends Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> {
  /** Required: names the dialog for screen readers and is shown as its heading. */
  title: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Hide the corner close button (then give the user another way out, like a Cancel button). */
  hideClose?: boolean;
}

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

export function DialogContent({
  title,
  description,
  size = "md",
  hideClose,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        // Without a description, tell Radix explicitly so aria-describedby does not point at nothing.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed top-1/2 left-1/2 z-modal grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto",
          "rounded-card border-2 border-line bg-surface p-card text-fg shadow-sticker-lg",
          "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          sizes[size],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1 pt-1">
            <DialogPrimitive.Title className="text-heading">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-small text-fg-muted">{description}</DialogPrimitive.Description>
            )}
          </div>
          {!hideClose && <CloseButton />}
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Actions at the bottom of a dialog. The main action goes last (rightmost on wide screens). */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end", className)} {...props} />;
}
