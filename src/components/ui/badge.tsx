import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        success:
          "border-transparent bg-success text-success-foreground hover:bg-success/80",
        warning:
          "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
        info: "border-transparent bg-info text-info-foreground hover:bg-info/80",
        outline: "text-foreground",
        /*
         * The tinted forms, for status that repeats down a list.
         *
         * A column of solid gold and solid red badges is a column that reads as
         * alarm rather than as data; the tint carries the same state at the
         * weight a table wants. Each pairs a `-soft` ground with a `-strong`
         * label, which is the pair the palette guarantees is readable.
         */
        "soft-success": "border-success/30 bg-success-soft text-success-strong",
        "soft-warning": "border-warning/40 bg-warning-soft text-warning-strong",
        "soft-info": "border-info/30 bg-info-soft text-info-strong",
        "soft-destructive":
          "border-destructive/30 bg-destructive-soft text-destructive-strong",
        "soft-primary": "border-primary/40 bg-primary-soft text-primary-strong",
        "soft-neutral": "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
