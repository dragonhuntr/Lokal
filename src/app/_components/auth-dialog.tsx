"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { useSession } from "@/trpc/session";

export interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "signin" | "signup";
}

export function AuthDialog({ open, onOpenChange, defaultMode = "signin" }: AuthDialogProps) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);
  const session = useSession();

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const validatePassword = (value: string) => {
    return value.length >= 8;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value.length > 0) {
      setEmailValid(validateEmail(value));
    } else {
      setEmailValid(null);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value.length > 0) {
      setPasswordValid(validatePassword(value));
    } else {
      setPasswordValid(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "signin") {
        await session.signIn(email, password);
      } else {
        await session.signUp(email, password, name.trim() || undefined);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">
              {mode === "signin" ? "Sign in" : "Create account"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-muted/40 p-1" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              aria-controls="auth-form-panel"
              onClick={() => setMode("signin")}
              className={`rounded-md px-3 py-1.5 text-sm ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              aria-controls="auth-form-panel"
              onClick={() => setMode("signup")}
              className={`rounded-md px-3 py-1.5 text-sm ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign up
            </button>
          </div>

          <form id="auth-form-panel" role="tabpanel" onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1">
                <label htmlFor="name" className="text-xs font-medium">Name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-medium">Email</label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="you@example.com"
                  required
                  aria-describedby={error ? "auth-error" : undefined}
                  aria-invalid={emailValid === false ? "true" : "false"}
                  className={`h-9 w-full rounded-md border bg-background px-3 pr-8 text-sm outline-none focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
                    emailValid === true ? "border-green-500" : emailValid === false ? "border-red-500" : ""
                  }`}
                />
                {emailValid === true && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 text-sm" aria-label="Valid email">✓</span>
                )}
              </div>
              {emailValid === false && (
                <p className="text-xs text-red-600">Please enter a valid email address</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-medium">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="••••••••"
                  required
                  aria-describedby={error ? "auth-error" : undefined}
                  aria-invalid={passwordValid === false ? "true" : "false"}
                  className={`h-9 w-full rounded-md border bg-background px-3 pr-8 text-sm outline-none focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
                    passwordValid === true ? "border-green-500" : passwordValid === false ? "border-red-500" : ""
                  }`}
                />
                {passwordValid === true && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 text-sm" aria-label="Valid password">✓</span>
                )}
              </div>
              {passwordValid === false && mode === "signup" && (
                <p className="text-xs text-red-600">Password must be at least 8 characters</p>
              )}
            </div>

            {error && <div id="auth-error" role="alert" className="text-xs text-red-600">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


