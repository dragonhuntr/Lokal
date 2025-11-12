"use client";

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * ErrorBoundary props
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Fallback UI to display when an error occurs
   */
  fallback?: React.ComponentType<ErrorFallbackProps>;
  /**
   * Callback when an error is caught
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * ErrorFallback props
 */
export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

/**
 * ErrorBoundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default fallback UI component
 */
function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-6 rounded-lg border border-destructive/20 bg-destructive/5 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            We encountered an unexpected error. You can try reloading the page
            or contact support if the problem persists.
          </p>
        </div>
      </div>

      {process.env.NODE_ENV === "development" && (
        <details className="w-full max-w-2xl rounded-md border bg-background p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Error details
          </summary>
          <pre className="mt-3 overflow-x-auto text-xs text-muted-foreground">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}

      <Button onClick={resetError} size="lg" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}

/**
 * ErrorBoundary component for catching and handling React errors
 *
 * This is a class component that uses React's error boundary lifecycle methods
 * to catch errors in the component tree and display a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 *
 * // With custom fallback
 * <ErrorBoundary fallback={CustomErrorFallback}>
 *   <YourComponent />
 * </ErrorBoundary>
 *
 * // With error logging
 * <ErrorBoundary onError={(error, errorInfo) => {
 *   console.error('Error caught:', error, errorInfo);
 * }}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback ?? DefaultErrorFallback;

      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
