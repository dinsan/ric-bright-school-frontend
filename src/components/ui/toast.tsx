"use client";

import { CircleCheck, CircleExclamationPoint, Info, TriangleExclamationPoint, X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds. Defaults to 6 seconds; errors stay until dismissed. */
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
  open: boolean;
}

// A tiny store so toast() can be called from anywhere (event handlers, mutations).
let toasts: ToastRecord[] = [];
let nextId = 1;
/**
 * Workaround for Radix Toast: timers pause while the pointer or focus is in the toast area, but if
 * the last toast disappears while paused (for example dismissed with the mouse) the pause is never
 * lifted, and every later toast stays on screen. Remounting the provider when a toast arrives in an
 * empty list resets it. Skipped if keyboard focus is in the toast area, so focus is not lost.
 */
let generation = 0;
/** More than this many toasts would cover the page (and a phone screen): older ones close. */
const MAX_VISIBLE = 3;
const VIEWPORT_ID = "toast-viewport";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Shows a short, non-blocking message, for example "Lesson saved". It is announced to screen
 * readers. Do not put actions the user must take in a toast; use an Alert or Dialog for those.
 */
export function toast(options: ToastOptions) {
  const id = nextId++;
  const focusInToasts = typeof document !== "undefined" && document.getElementById(VIEWPORT_ID)?.parentElement?.contains(document.activeElement);
  if (toasts.length === 0 && !focusInToasts) {
    generation += 1;
  }
  toasts = [...toasts, { ...options, id, open: true }];
  emit();
  // Keep at most MAX_VISIBLE on screen: close the oldest, sparing errors while possible.
  const open = toasts.filter((item) => item.open);
  if (open.length > MAX_VISIBLE) {
    const oldest = open.find((item) => item.tone !== "danger" && item.id !== id) ?? open[0];
    if (oldest) dismiss(oldest.id);
  }
  return id;
}

function dismiss(id: number) {
  toasts = toasts.map((item) => (item.id === id ? { ...item, open: false } : item));
  emit();
  // Remove after the exit animation.
  setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
  }, 400);
}

const icons = { info: Info, success: CircleCheck, warning: TriangleExclamationPoint, danger: CircleExclamationPoint };
const tones = {
  info: "bg-surface text-fg",
  success: "bg-success-soft text-success-soft-fg",
  warning: "bg-warning-soft text-warning-soft-fg",
  danger: "bg-danger-soft text-danger-soft-fg",
};

/** Renders toasts. Mounted once, in the app providers. */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => toasts);
  const providerKey = useSyncExternalStore(subscribe, () => generation, () => 0);
  return (
    <ToastPrimitive.Provider key={providerKey} swipeDirection="right" label="Notification">
      {items.map(({ id, open, title, description, tone = "info", duration }) => {
        const Icon = icons[tone];
        return (
          <ToastPrimitive.Root
            key={id}
            open={open}
            onOpenChange={(next) => !next && dismiss(id)}
            duration={duration ?? (tone === "danger" ? Infinity : 6000)}
            type={tone === "danger" ? "foreground" : "background"}
            className={cn(
              "flex w-full items-start gap-3 rounded-card border-2 border-line p-4 shadow-sticker",
              "data-[state=open]:animate-slide-in-right data-[state=closed]:animate-fade-out",
              "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-slide-out-right",
              tones[tone],
            )}
          >
            <Icon aria-hidden className="mt-0.5 size-icon shrink-0" />
            <div className="grid flex-1 gap-0.5">
              <ToastPrimitive.Title className="font-bold">{title}</ToastPrimitive.Title>
              {description && <ToastPrimitive.Description className="text-small">{description}</ToastPrimitive.Description>}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              // Don't take focus on a mouse press: Radix would then move focus into the toast list
              // when this toast closes, which pauses every later toast's timer until the user clicks
              // elsewhere. Keyboard users (F8 / Tab) still get focus and the intended pause.
              onMouseDown={(event) => event.preventDefault()}
              className="-m-1 inline-flex size-control-sm shrink-0 items-center justify-center rounded-control hover:bg-surface-sunken/60 [&_svg]:size-icon"
            >
              <X aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport
        id={VIEWPORT_ID}
        className="fixed right-0 bottom-0 z-toast flex w-full max-w-sm flex-col gap-3 p-4 outline-none" />
    </ToastPrimitive.Provider>
  );
}
