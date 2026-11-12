import Link from "next/link";
import { Slot } from "radix-ui";
import type { ComponentProps, MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

// Labels may wrap (long text, larger type for young learners, translations): the button grows
// taller instead of overflowing the screen. Heights are minimums for the same reason.
const base =
  "inline-flex max-w-full shrink-0 select-none items-center justify-center gap-2 rounded-control border-2 text-center font-bold leading-tight " +
  "transition-[transform,box-shadow,background-color,color] duration-fast ease-playful " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 " +
  "[&_svg]:size-icon [&_svg]:shrink-0";

// The "sticker" press: lifts on hover, flattens when pressed.
const sticker =
  "shadow-sticker hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none";

const variants: Record<ButtonVariant, string> = {
  primary: cn("border-line bg-primary text-primary-fg hover:bg-primary-hover", sticker),
  secondary: cn("border-line bg-surface text-fg hover:bg-surface-sunken", sticker),
  ghost: "border-transparent bg-transparent text-fg hover:bg-surface-sunken",
  danger: cn("border-line bg-danger text-danger-fg hover:bg-danger-hover", sticker),
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-control-sm px-3 py-1 text-small",
  md: "min-h-control px-control-x py-1.5 text-control",
  lg: "min-h-control-lg px-6 py-2 text-lead",
  icon: "size-control p-0",
};

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Class names for anything that should look like a button (links, menu triggers). */
export function buttonVariants({ variant = "secondary", size = "md" }: ButtonStyleProps = {}, className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ComponentProps<"button">, ButtonStyleProps {
  /** Shows a spinner, marks the button busy and ignores clicks. The label stays, so width is stable. */
  loading?: boolean;
  /**
   * Render the child element (for example a Link) with button styles instead of a <button>.
   * `disabled` and `loading` then make it aria-disabled and unfocusable (no spinner is added).
   */
  asChild?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  asChild = false,
  className,
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = buttonVariants({ variant, size }, className);
  if (asChild) {
    // A link can't be `disabled`: mark it aria-disabled (the styles then block the pointer), take it
    // out of the tab order and swallow activation. No spinner here: the child is rendered as is.
    const inactive = disabled || loading;
    return (
      <Slot.Root
        className={cn(classes, loading && "cursor-wait")}
        aria-disabled={inactive || undefined}
        aria-busy={loading || undefined}
        tabIndex={inactive ? -1 : undefined}
        {...props}
        onClick={inactive ? (event: MouseEvent) => event.preventDefault() : props.onClick}
      >
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type}
      // While loading the button stays enabled, so keyboard focus is not lost mid-submit;
      // clicks (and Enter in a form) are swallowed instead, which also prevents double submits.
      className={cn(classes, loading && "cursor-wait")}
      disabled={disabled}
      aria-busy={loading || undefined}
      {...props}
      onClick={loading ? (event) => event.preventDefault() : props.onClick}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyleProps) {
  return <Link className={buttonVariants({ variant, size }, className)} {...props} />;
}
