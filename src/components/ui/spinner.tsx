import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Spinner component for indicating loading states
 *
 * @example
 * ```tsx
 * <Spinner size="sm" />
 * <Spinner size="md" />
 * <Spinner size="lg" />
 * ```
 */
const spinnerVariants = cva(
  "animate-spin rounded-full border-2 border-current border-t-transparent",
  {
    variants: {
      size: {
        sm: "h-3 w-3",
        md: "h-4 w-4",
        lg: "h-6 w-6",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

interface SpinnerProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof spinnerVariants> {
  /**
   * Accessible label for screen readers
   */
  "aria-label"?: string
}

function Spinner({
  className,
  size,
  "aria-label": ariaLabel = "Loading",
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn(spinnerVariants({ size, className }))}
      {...props}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}

export { Spinner, spinnerVariants }
export default Spinner
