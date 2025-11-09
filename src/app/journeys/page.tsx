"use client";

import { useState } from "react";
import { Trash2, MapPin, Clock, Calendar, Share2, Edit2, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSavedRoutes } from "@/trpc/saved-routes";
import { useSession } from "@/trpc/session";
import { AuthDialog } from "@/app/_components/auth-dialog";

export default function JourneysPage() {
  const router = useRouter();
  const session = useSession();
  const saved = useSavedRoutes();
  const [authOpen, setAuthOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  if (session.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (session.status !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">My Journeys</h1>
          <p className="mt-2 text-muted-foreground">Sign in to view your saved routes</p>
        </div>
        <button
          onClick={() => setAuthOpen(true)}
          className="rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
        >
          Sign In
        </button>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode="signin" />
      </div>
    );
  }

  const handleEdit = (routeId: string, currentNickname: string | null) => {
    setEditingId(routeId);
    setEditNickname(currentNickname ?? "");
  };

  const handleSaveEdit = async (routeId: string) => {
    try {
      // Remove the old one and save a new one with updated nickname
      await saved.remove(routeId);
      await saved.save(routeId, editNickname.trim() || undefined);
      setEditingId(null);
      setEditNickname("");
    } catch (error) {
      console.error("Failed to update nickname", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNickname("");
  };

  const handleShare = (routeId: string, _routeName: string) => {
    const url = `${window.location.origin}/route/${routeId}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareSuccess(routeId);
      setTimeout(() => setShareSuccess(null), 2000);
    }).catch((err) => {
      console.error("Failed to copy URL", err);
    });
  };

  const handleDelete = async (routeId: string) => {
    if (confirm("Are you sure you want to remove this saved route?")) {
      await saved.remove(routeId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Journeys</h1>
              <p className="text-sm text-muted-foreground">
                {saved.routes.length} saved route{saved.routes.length === 1 ? "" : "s"}
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Back to Map
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4">
        {saved.isFetching ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading your journeys...</div>
          </div>
        ) : saved.routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-16 w-16 text-muted-foreground/40" />
            <h2 className="mt-4 text-xl font-semibold">No saved routes yet</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Start planning a journey and save your favorite routes for quick access
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-md bg-foreground px-6 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Plan a Journey
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.routes.map((savedRoute) => (
              <div
                key={savedRoute.id}
                className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition hover:shadow-md"
              >
                <div className="p-4">
                  {editingId === savedRoute.routeId ? (
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                        placeholder="Nickname (optional)"
                        className="h-8 flex-1 rounded border bg-background px-2 text-sm outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(savedRoute.routeId)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                        aria-label="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border hover:bg-muted"
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : savedRoute.nickname ? (
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{savedRoute.nickname}</h3>
                      <button
                        onClick={() => handleEdit(savedRoute.routeId, savedRoute.nickname)}
                        className="opacity-0 transition group-hover:opacity-100"
                        aria-label="Edit nickname"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(savedRoute.routeId, null)}
                      className="mb-1 flex w-full items-center justify-between gap-2 text-left opacity-0 transition group-hover:opacity-100"
                    >
                      <span className="text-sm text-muted-foreground">Add nickname</span>
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}

                  <div className="mb-2">
                    <div className="text-xl font-bold text-foreground">{savedRoute.route.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Route {savedRoute.route.number}</div>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{savedRoute.route.origin} → {savedRoute.route.destination}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{savedRoute.route.duration} min</span>
                      <span>&middot;</span>
                      <span>{savedRoute.route.totalStops} stops</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Saved {new Date(savedRoute.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => router.push(`/?routeId=${savedRoute.route.id}`)}
                      className="flex-1 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90"
                    >
                      View on Map
                    </button>
                    <button
                      onClick={() => handleShare(savedRoute.routeId, savedRoute.route.name)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
                      aria-label="Share"
                      title={shareSuccess === savedRoute.routeId ? "Link copied!" : "Share"}
                    >
                      <Share2 className={`h-4 w-4 ${shareSuccess === savedRoute.routeId ? "text-green-600" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleDelete(savedRoute.routeId)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-red-600 hover:bg-red-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
