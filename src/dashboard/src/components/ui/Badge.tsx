import * as React from "react"
import { cn } from "../../lib/utils"

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'thinking' | 'muted';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  pulse?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  error: "bg-rose-50 text-rose-700 border-rose-100",
  info: "bg-blue-50 text-blue-700 border-blue-100",
  thinking: "bg-indigo-50 text-indigo-700 border-indigo-100",
  muted: "bg-muted/60 text-muted-foreground/80",
}

const dotStyles: Record<BadgeVariant, string> = {
  default: "bg-muted-foreground",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  info: "bg-blue-500",
  thinking: "bg-indigo-500",
  muted: "bg-muted-foreground/50",
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', dot = false, pulse = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-semibold tracking-wide transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          dotStyles[variant],
          pulse && "animate-pulse-dot"
        )} />
      )}
      {children}
    </span>
  )
)
Badge.displayName = "Badge"

export { Badge }
