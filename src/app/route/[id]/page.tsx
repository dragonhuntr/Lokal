"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MapPin, Clock, Bookmark, Share2, ArrowLeft } from "lucide-react";
import { useSession } from "@/trpc/session";
import { useSavedItems } from "@/trpc/saved-items";
import { AuthDialog } from "@/app/_components/auth-dialog";

interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
}

interface RouteDetails {
  id: string;
  name: string;
  number: string;
  origin: string;
  destination: string;
  totalStops: number;
  duration: number;
  stops: Stop[];
}

export default function SharedRoutePage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params.id as string;
  const session = useSession();
  const savedItems = useSavedItems();
  const [route, setRoute] = useState<RouteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/routes/${encodeURIComponent(routeId)}`);

        if (!response.ok) {
          throw new Error("Bus line not found");
        }

        const data = (await response.json()) as { route: RouteDetails };
        setRoute(data.route);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch route", err);
        setError("Failed to load bus line details");
      } finally {
        setLoading(false);
      }
    };

    if (routeId) {
      void fetchRoute();
    }
  }, [routeId]);

  const handleSave = async () => {
    if (session.status !== "authenticated") {
      setAuthOpen(true);
      return;
    }

    if (!route) return;

    try {
      const existingSaved = savedItems.routes.find((r) => r.routeId === routeId);
      if (existingSaved) {
        await savedItems.remove(existingSaved.id);
      } else {
        await savedItems.saveRoute(routeId, route.name);
      }
    } catch (err) {
      console.error("Failed to save bus line", err);
      alert("Failed to save bus line. Please try again.");
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    }).catch((err) => {
      console.error("Failed to copy URL", err);
    });
  };

  const handleViewOnMap = () => {
    router.push(`/?routeId=${routeId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading bus line details...</div>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600">Bus Line Not Found</h1>
          <p className="mt-2 text-muted-foreground">{error ?? "This bus line doesn't exist"}</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-md border px-6 py-3 text-sm font-medium hover:bg-muted"
        >
          Back to Map
        </button>
      </div>
    );
  }

  const isSaved = savedItems.routes.some((r) => r.routeId === routeId);

  // Calculate estimated time per stop (average)
  const timePerStop = route.stops.length > 1 ? route.duration / (route.stops.length - 1) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Map
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4">
        <div className="rounded-lg border bg-card shadow-lg overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="mb-2 inline-flex items-center justify-center rounded-lg bg-white/20 px-3 py-1 text-sm font-bold">
                  {route.number}
                </div>
                <h1 className="text-2xl font-bold">{route.name}</h1>
                <p className="mt-2 text-sm text-blue-100">
                  {route.origin} → {route.destination}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-blue-100">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{route.duration} min</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{route.totalStops} stops</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSave}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  isSaved
                    ? "bg-white text-blue-700"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
                aria-label={isSaved ? "Unsave bus line" : "Save bus line"}
              >
                <Bookmark className="h-4 w-4" fill={isSaved ? "currentColor" : "none"} />
                {isSaved ? "Saved" : "Save"}
              </button>
              <button
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/30"
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" />
                {shareSuccess ? "Copied!" : "Share"}
              </button>
            </div>
          </div>

          {/* Stops List */}
          <div className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <MapPin className="h-5 w-5 text-blue-600" />
              All Stops
            </h2>

            <div className="relative">
              {/* Vertical line connecting stops */}
              <div className="absolute left-2 top-4 bottom-4 w-0.5 bg-blue-200"></div>

              <ul className="space-y-0">
                {route.stops.map((stop, index) => {
                  const estimatedTime = Math.round(index * timePerStop);
                  const isFirst = index === 0;
                  const isLast = index === route.stops.length - 1;

                  return (
                    <li key={stop.id} className="relative flex items-start gap-3 pb-4">
                      {/* Stop marker */}
                      <div className={`relative z-10 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                        isFirst || isLast
                          ? "bg-blue-600 ring-4 ring-blue-100"
                          : "bg-white border-2 border-blue-400"
                      }`}>
                        {(isFirst || isLast) && (
                          <div className="h-2 w-2 rounded-full bg-white"></div>
                        )}
                      </div>

                      {/* Stop info */}
                      <div className="flex-1 pt-0.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-foreground">{stop.name}</div>
                            {isFirst && (
                              <div className="mt-0.5 text-xs text-blue-600 font-medium">Origin</div>
                            )}
                            {isLast && (
                              <div className="mt-0.5 text-xs text-blue-600 font-medium">Destination</div>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {estimatedTime > 0 ? `${estimatedTime}m` : "0m"}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t bg-muted/30 p-4">
            <button
              onClick={handleViewOnMap}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              View on Map
            </button>
          </div>

          {session.status !== "authenticated" && (
            <div className="border-t bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                <button
                  onClick={() => setAuthOpen(true)}
                  className="font-medium underline hover:no-underline"
                >
                  Sign in
                </button>{" "}
                to save this bus line and access more features
              </p>
            </div>
          )}
        </div>
      </main>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode="signup" />
    </div>
  );
}
