import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, CheckCircle2, Info, X, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Alert component for displaying important messages to users
 *
 * Supports multiple variants (info, success, warning, error), icons, and dismissible option
 *
 * @example
 * ```tsx
 * <Alert variant="info">
 *   <AlertTitle>Information</AlertTitle>
 *   <AlertDescription>This is an informational message.</AlertDescription>
 * </Alert>
 *
 * <Alert variant="success" dismissible onDismiss={() => console.log('dismissed')}>
 *   <AlertTitle>Success!</AlertTitle>
 *   <AlertDescription>Your changes have been saved.</AlertDescription>
 * </Alert>
 * ```
 */
const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        info: "bg-blue-50 border-blue-200 text-blue-900 [&>svg]:text-blue-600 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-100 dark:[&>svg]:text-blue-400",
        success:
          "bg-green-50 border-green-200 text-green-900 [&>svg]:text-green-600 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-100 dark:[&>svg]:text-green-400",
        warning:
          "bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-100 dark:[&>svg]:text-amber-400",
        error:
          "bg-red-50 border-red-200 text-red-900 [&>svg]:text-red-600 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-100 dark:[&>svg]:text-red-400",
        default:
          "bg-background text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
  default: undefined,
}

interface AlertProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof alertVariants> {
  /**
   * Whether the alert can be dismissed
   */
  dismissible?: boolean
  /**
   * Callback when alert is dismissed
   */
  onDismiss?: () => void
  /**
   * Whether to show the icon
   */
  showIcon?: boolean
}

function Alert({
  className,
  variant = "default",
  dismissible = false,
  onDismiss,
  showIcon = true,
  children,
  ...props
}: AlertProps) {
  const [isDismissed, setIsDismissed] = React.useState(false)
  const Icon = variant ? iconMap[variant] : undefined

  if (isDismissed) {
    return null
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(alertVariants({ variant }), dismissible && "pr-10", className)}
      {...props}
    >
      {showIcon && Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      <div className="w-full">{children}</div>
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-md p-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

interface AlertTitleProps extends React.ComponentProps<"h5"> {}

function AlertTitle({ className, ...props }: AlertTitleProps) {
  return (
    <h5
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
}

interface AlertDescriptionProps extends React.ComponentProps<"div"> {}

function AlertDescription({ className, ...props }: AlertDescriptionProps) {
  return (
    <div
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
