"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Input } from "./input";

/**
 * A password field with a show/hide button (helps young learners and everyone on a phone).
 * Use inside a FormField like an Input. `autoComplete` should be "current-password" or "new-password".
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block min-w-0">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-14", className)} spellCheck={false} />
      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((value) => !value)}
        className="absolute top-1/2 right-1 inline-flex size-control-sm -translate-y-1/2 items-center justify-center rounded-control text-fg-muted hover:bg-surface-sunken hover:text-fg [&_svg]:size-icon"
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </button>
    </span>
  );
}
