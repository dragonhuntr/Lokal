"use client";

import { useState } from "react";
import { Trash2, MapPin, Clock, Calendar, Footprints, Bus, Route as RouteIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSavedItems } from "@/trpc/saved-items";
import { useSession } from "@/trpc/session";
import { AuthDialog } from "@/app/_components/auth-dialog";

export default function JourneysPage() {
  const router = useRouter();
  const session = useSession();
  const savedItems = useSavedItems();
  const [authOpen, setAuthOpen] = useState(false);

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
          <h1 className="text-3xl font-bold">My Saved Items</h1>
          <p className="mt-2 text-muted-foreground">Sign in to view your saved routes and journeys</p>
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

  const handleDelete = async (itemId: string) => {
    if (confirm("Are you sure you want to remove this saved item?")) {
      await savedItems.remove(itemId);
    }
  };

  const handleViewItem = (itemId: string) => {
    router.push(`/?itemId=${itemId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Saved Items</h1>
              <p className="text-sm text-muted-foreground">
                {savedItems.items.length} saved item{savedItems.items.length === 1 ? "" : "s"}
                {savedItems.journeys.length > 0 && ` (${savedItems.journeys.length} journey${savedItems.journeys.length === 1 ? "" : "s"}, ${savedItems.routes.length} route${savedItems.routes.length === 1 ? "" : "s"})`}
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
        {savedItems.isFetching ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading your saved items...</div>
          </div>
        ) : savedItems.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-16 w-16 text-muted-foreground/40" />
            <h2 className="mt-4 text-xl font-semibold">No saved items yet</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Start planning a journey or save your favorite bus routes for quick access
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-md bg-foreground px-6 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Explore Routes
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedItems.items.map((item) => {
              if (item.type === "JOURNEY") {
                const { itineraryData } = item;
                const walkLegs = itineraryData.legs.filter((leg) => leg.type === "walk");
                const busLegs = itineraryData.legs.filter((leg) => leg.type === "bus");
                const totalLegs = itineraryData.legs.length;

                return (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition hover:shadow-md"
                  >
                    <div className="p-4">
                      {item.nickname && (
                        <div className="mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{item.nickname}</h3>
                        </div>
                      )}

                      <div className="mb-3 space-y-1">
                        {itineraryData.routeName && (
                          <div className="text-base font-medium text-foreground">
                            {itineraryData.routeName}
                          </div>
                        )}
                        {itineraryData.routeNumber && (
                          <div className="text-sm text-muted-foreground">Route {itineraryData.routeNumber}</div>
                        )}
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>
                            {item.totalDistance && item.totalDistance >= 1000
                              ? `${(item.totalDistance / 1000).toFixed(1)} km`
                              : `${item.totalDistance} m`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{item.totalDuration} min</span>
                          <span>&middot;</span>
                          <span>{totalLegs} leg{totalLegs === 1 ? "" : "s"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {walkLegs.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Footprints className="h-3.5 w-3.5" />
                                {walkLegs.length}
                              </span>
                            )}
                            {busLegs.length > 0 && (
                              <span className="flex items-center gap-1 ml-2">
                                <Bus className="h-3.5 w-3.5" />
                                {busLegs.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Saved {new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleViewItem(item.id)}
                          className="flex-1 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90"
                        >
                          View on Map
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-red-600 hover:bg-red-50"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // ROUTE type
                return (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition hover:shadow-md"
                  >
                    <div className="p-4">
                      <div className="mb-3 flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <RouteIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          {item.nickname && (
                            <h3 className="text-lg font-semibold text-foreground">{item.nickname}</h3>
                          )}
                          <p className="text-sm text-muted-foreground">Bus Route</p>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Saved {new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleViewItem(item.id)}
                          className="flex-1 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90"
                        >
                          View Route
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-red-600 hover:bg-red-50"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </main>
    </div>
  );
}
