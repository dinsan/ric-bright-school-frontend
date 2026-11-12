import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends ComponentProps<"div"> {
  /** Lifts on hover. Use when the whole card is a link (pass the link with `asChild`). */
  interactive?: boolean;
  /** "sticker" (default) has the offset shadow; "flat" is for cards inside cards or dense lists. */
  variant?: "sticker" | "flat";
  asChild?: boolean;
}

export function Card({ interactive, variant = "sticker", asChild, className, ...props }: CardProps) {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={cn(
        "flex flex-col gap-4 rounded-card border-2 border-line bg-surface p-card text-fg",
        variant === "sticker" && "shadow-sticker",
        interactive &&
          "transition-[transform,box-shadow] duration-fast ease-playful hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sticker-lg",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("grid gap-1", className)} {...props} />;
}

export interface CardTitleProps extends ComponentProps<"h3"> {
  /** Heading level that fits the page outline (default h3: cards usually sit under a section h2). */
  as?: "h2" | "h3" | "h4";
}

export function CardTitle({ as: Heading = "h3", className, ...props }: CardTitleProps) {
  return <Heading className={cn("text-lead font-extrabold leading-snug wrap-break-word", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-small text-fg-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("grid gap-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-auto flex flex-wrap items-center gap-3", className)} {...props} />;
}
