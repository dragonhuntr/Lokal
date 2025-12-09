"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSession } from "@/trpc/session";

export interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { user, refetch } = useSession();
  const [name, setName] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    // Check actual permission state, not just user preference
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, [user]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(
        (registration) => {
          console.log("Service Worker registration successful with scope: ", registration.scope);
        },
        (err) => {
          console.log("Service Worker registration failed: ", err);
        }
      );
    }
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      if ((user.name ?? "") !== name.trim()) {
        const res = await fetch(`/api/user/${encodeURIComponent(user.id)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to update profile");
      }

      // We don't sync notification preference to backend here anymore as it's browser permission based
      // But if we wanted to store "user wants notifications" we could. 
      // For now, we just rely on browser permission.

      await refetch();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifications = async (checked: boolean) => {
    if (checked) {
      if (!("Notification" in window)) {
        setError("This browser does not support desktop notification");
        return;
      }

      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");

      if (permission === "granted") {
        // Optionally sync to backend that user enabled notifications
        if (user) {
          await fetch(`/api/user/${encodeURIComponent(user.id)}/preferences`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ notificationsEnabled: true }),
            credentials: "include",
          });
        }
      }
    } else {
      // We can't programmatically revoke permission, but we can update state/backend
      setNotificationsEnabled(false);
      if (user) {
        await fetch(`/api/user/${encodeURIComponent(user.id)}/preferences`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notificationsEnabled: false }),
          credentials: "include",
        });
      }
    }
  };

  const sendTestNotification = () => {
    setTimeout(() => {
      if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification("Test Notification", {
            body: "This is a test notification from Lokal",
            icon: "/logo.png",
          });
        });
      } else {
        setError("Please enable notifications first");
      }
    }, 3000);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/40" />
        <Dialog.Content
          className="pointer-events-auto fixed left-1/2 top-1/2 z-[9999] w-[calc(100vw-2rem)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xl"
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">Your profile</Dialog.Title>
            <Dialog.Close asChild>
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => toggleNotifications(e.target.checked)}
                  className="h-4 w-4"
                />
                Receive notifications
              </label>

              <button
                onClick={sendTestNotification}
                className="text-xs text-blue-500 hover:underline"
                type="button"
              >
                Test (3s delay)
              </button>
            </div>

            {error && <div className="text-xs text-red-600">{error}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


