"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MapPin, Clock, Bookmark, Share2, ArrowLeft } from "lucide-react";
import { useSession } from "@/trpc/session";
import { useSavedRoutes } from "@/trpc/saved-routes";
import { AuthDialog } from "@/app/_components/auth-dialog";

interface RouteDetails {
  id: string;
  name: string;
  number: string;
  origin: string;
  destination: string;
  totalStops: number;
  duration: number;
}

export default function SharedRoutePage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params.id as string;
  const session = useSession();
  const saved = useSavedRoutes();
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
          throw new Error("Route not found");
        }

        const data = (await response.json()) as RouteDetails;
        setRoute(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch route", err);
        setError("Failed to load route details");
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
      if (saved.isSaved(routeId)) {
        await saved.remove(routeId);
      } else {
        await saved.save(routeId, route.name);
      }
    } catch (err) {
      console.error("Failed to save route", err);
      alert("Failed to save route. Please try again.");
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
        <div className="text-lg text-muted-foreground">Loading route details...</div>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600">Route Not Found</h1>
          <p className="mt-2 text-muted-foreground">{error ?? "This route doesn't exist"}</p>
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

  const isSaved = saved.isSaved(routeId);

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
        <div className="rounded-lg border bg-card p-6 shadow-lg">
          <div className="mb-6">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{route.name}</h1>
                <p className="mt-1 text-lg text-muted-foreground">Route {route.number}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Route</div>
                <div className="text-base text-foreground">
                  {route.origin} → {route.destination}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="mt-1 h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Duration</div>
                <div className="text-base text-foreground">{route.duration} minutes</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Stops</div>
                <div className="text-base text-foreground">{route.totalStops} stops</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3 border-t pt-6">
            <button
              onClick={handleViewOnMap}
              className="flex-1 rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background hover:opacity-90"
            >
              View on Map
            </button>
            <button
              onClick={handleSave}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition ${
                isSaved
                  ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "hover:bg-muted"
              }`}
              aria-label={isSaved ? "Unsave route" : "Save route"}
            >
              <Bookmark className="h-4 w-4" fill={isSaved ? "currentColor" : "none"} />
              {isSaved ? "Saved" : "Save"}
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium hover:bg-muted"
              aria-label="Share"
            >
              <Share2 className={`h-4 w-4 ${shareSuccess ? "text-green-600" : ""}`} />
              {shareSuccess ? "Copied!" : "Share"}
            </button>
          </div>

          {session.status !== "authenticated" && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                <button
                  onClick={() => setAuthOpen(true)}
                  className="font-medium underline hover:no-underline"
                >
                  Sign in
                </button>{" "}
                to save this route and access more features
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-lg border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">About This Route</h2>
          <p className="text-sm text-muted-foreground">
            This route connects {route.origin} to {route.destination} with {route.totalStops} stops
            along the way. The typical journey takes approximately {route.duration} minutes.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Share this link with friends to help them plan their journey, or save it to your account
            for quick access.
          </p>
        </div>
      </main>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode="signup" />
    </div>
  );
}
