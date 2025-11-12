import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input component following shadcn/ui patterns
 *
 * Supports error states, disabled states, and works with React.forwardRef
 * for form libraries like react-hook-form
 *
 * @example
 * ```tsx
 * <Input type="text" placeholder="Enter your name" />
 * <Input type="email" disabled />
 * <Input type="password" aria-invalid={true} />
 * ```
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Error state - applies error styling
   */
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, "aria-invalid": ariaInvalid, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          error && "border-destructive ring-destructive/20 dark:ring-destructive/40",
          className
        )}
        aria-invalid={error ?? ariaInvalid}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
