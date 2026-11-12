"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field-context";

/** Shared look of text-like controls (Input, Textarea, Select). */
export const controlClass =
  "w-full rounded-control border-2 border-line bg-surface px-3 text-control text-fg " +
  "placeholder:text-fg-muted transition-colors duration-fast " +
  "hover:bg-surface-sunken/40 disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-invalid:border-danger aria-invalid:shadow-[inset_0_0_0_1px_var(--danger)] " +
  // [readonly], not :read-only — the pseudo-class also matches every <select>.
  "[&[readonly]]:bg-surface-sunken";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  const wired = useFieldControl(props);
  return <input type={type} className={cn(controlClass, "h-control", className)} {...wired} />;
}
