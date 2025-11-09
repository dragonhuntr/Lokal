"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Star, X } from "lucide-react";
import { useSession } from "@/trpc/session";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeId?: string;
  routeName?: string;
  stopId?: string;
  stopName?: string;
}

export function FeedbackDialog({
  open,
  onOpenChange,
  routeId,
  routeName,
  stopId,
  stopName,
}: FeedbackDialogProps) {
  const session = useSession();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!session.user || rating === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
          routeId,
          stopId,
          rating,
          comment: comment.trim() || undefined,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setRating(0);
        setComment("");
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to submit feedback", err);
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const targetName = routeName ?? stopName ?? "this route";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">
              Rate {targetName}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {success ? (
            <div className="py-8 text-center">
              <div className="mb-3 text-4xl">✓</div>
              <div className="text-lg font-semibold text-green-600">Thank you for your feedback!</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Your rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      onMouseEnter={() => setHoveredRating(value)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="transition hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          value <= (hoveredRating || rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Comments (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us about your experience..."
                  className="h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
                  maxLength={500}
                />
                <div className="mt-1 text-xs text-muted-foreground">
                  {comment.length}/500 characters
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || rating === 0}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
