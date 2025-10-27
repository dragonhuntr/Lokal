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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setNotificationsEnabled(user.notificationsEnabled);
  }, [user]);

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
      if (user.notificationsEnabled !== notificationsEnabled) {
        const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/preferences`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notificationsEnabled }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to update preferences");
      }
      await refetch();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">Your profile</Dialog.Title>
            <Dialog.Close asChild>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Close">
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

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              Receive notifications
            </label>

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


