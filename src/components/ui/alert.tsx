import { CircleCheck, CircleExclamationPoint, Info, TriangleExclamationPoint, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertTone = "info" | "success" | "warning" | "danger";

const tones: Record<AlertTone, { className: string; icon: LucideIcon }> = {
  info: { className: "bg-info-soft text-info-soft-fg", icon: Info },
  success: { className: "bg-success-soft text-success-soft-fg", icon: CircleCheck },
  warning: { className: "bg-warning-soft text-warning-soft-fg", icon: TriangleExclamationPoint },
  danger: { className: "bg-danger-soft text-danger-soft-fg", icon: CircleExclamationPoint },
};

export interface AlertProps extends Omit<ComponentProps<"div">, "title"> {
  tone?: AlertTone;
  title?: ReactNode;
  /** Buttons or links shown under the message. */
  action?: ReactNode;
}

/**
 * A message inside the page (not a popup). Say what happened and what to do next.
 * Pass role="alert" only when the alert appears in response to something the user just did.
 */
export function Alert({ tone = "info", title, action, className, children, ...props }: AlertProps) {
  const { className: toneClass, icon: Icon } = tones[tone];
  return (
    <div className={cn("flex gap-3 rounded-card border-2 border-line p-card", toneClass, className)} {...props}>
      <Icon aria-hidden className="mt-0.5 size-icon shrink-0" />
      <div className="grid min-w-0 content-start gap-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="text-small [&_a]:underline">{children}</div>}
        {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}
