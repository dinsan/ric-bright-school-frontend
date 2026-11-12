"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClass } from "./input";
import { useFieldControl } from "./field-context";

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  const wired = useFieldControl(props);
  return <textarea rows={rows} className={cn(controlClass, "min-h-control py-2.5", className)} {...wired} />;
}
