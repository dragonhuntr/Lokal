"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, Calendar, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "@/trpc/session";
import { AuthDialog } from "@/app/_components/auth-dialog";

interface Trip {
  id: string;
  userId: string;
  routeId: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";
  departureTime: string;
  arrivalTime: string | null;
  isRecurring: boolean;
  frequency: string | null;
  createdAt: string;
  route: {
    id: string;
    name: string;
    number: string;
    origin: string;
    destination: string;
  };
  startStop: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  } | null;
  endStop: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  } | null;
}

const statusConfig = {
  PLANNED: {
    label: "Planned",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    icon: Loader2,
  },
  COMPLETED: {
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-50",
    icon: CheckCircle2,
  },
  CANCELED: {
    label: "Canceled",
    color: "text-red-600",
    bgColor: "bg-red-50",
    icon: XCircle,
  },
};

export default function HistoryPage() {
  const router = useRouter();
  const session = useSession();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const fetchTrips = async () => {
      if (session.status !== "authenticated" || !session.user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/trip?userId=${encodeURIComponent(session.user.id)}`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch trips");
        }

        const data = (await response.json()) as { trips: Trip[] };
        setTrips(data.trips);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch trips", err);
        setError("Failed to load trip history");
      } finally {
        setLoading(false);
      }
    };

    void fetchTrips();
  }, [session.status, session.user]);

  const handleRetakeTrip = async (trip: Trip) => {
    if (!session.user) return;

    try {
      const response = await fetch("/api/trip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
          routeId: trip.routeId,
          startStopId: trip.startStop?.id,
          endStopId: trip.endStop?.id,
          departureTime: new Date().toISOString(),
          isRecurring: false,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to create trip");
      }

      // Refresh trips list
      const data = (await response.json()) as { trip: Trip };
      setTrips((prev) => [data.trip, ...prev]);
    } catch (err) {
      console.error("Failed to retake trip", err);
      alert("Failed to create trip. Please try again.");
    }
  };

  if (loading && session.status === "loading") {
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
          <h1 className="text-3xl font-bold">Trip History</h1>
          <p className="mt-2 text-muted-foreground">Sign in to view your trip history</p>
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

  const groupedTrips = trips.reduce((acc, trip) => {
    const status = trip.status;
    acc[status] ??= [];
    acc[status].push(trip);
    return acc;
  }, {} as Record<string, Trip[]>);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Trip History</h1>
              <p className="text-sm text-muted-foreground">
                {trips.length} trip{trips.length === 1 ? "" : "s"} recorded
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading your trip history...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-16 w-16 text-red-400" />
            <h2 className="mt-4 text-xl font-semibold text-red-600">{error}</h2>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Try Again
            </button>
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-16 w-16 text-muted-foreground/40" />
            <h2 className="mt-4 text-xl font-semibold">No trips yet</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Start planning and tracking your journeys to see them here
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-md bg-foreground px-6 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Plan a Journey
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTrips).map(([status, tripsInStatus]) => {
              const config = statusConfig[status as keyof typeof statusConfig];
              const StatusIcon = config.icon;

              return (
                <div key={status}>
                  <div className="mb-3 flex items-center gap-2">
                    <StatusIcon className={`h-5 w-5 ${config.color}`} />
                    <h2 className="text-lg font-semibold">{config.label}</h2>
                    <span className="text-sm text-muted-foreground">({tripsInStatus.length})</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {tripsInStatus.map((trip) => (
                      <div
                        key={trip.id}
                        className={`rounded-lg border ${config.bgColor} p-4 shadow-sm transition hover:shadow-md`}
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-foreground">{trip.route.name}</h3>
                            <p className="text-sm text-muted-foreground">Route {trip.route.number}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${config.color} ${config.bgColor}`}>
                            {config.label}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {trip.startStop?.name ?? trip.route.origin} → {trip.endStop?.name ?? trip.route.destination}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Departure: {new Date(trip.departureTime).toLocaleString()}</span>
                          </div>
                          {trip.arrivalTime && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Arrival: {new Date(trip.arrivalTime).toLocaleString()}</span>
                            </div>
                          )}
                          {trip.isRecurring && trip.frequency && (
                            <div className="flex items-center gap-2">
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span>Recurring: {trip.frequency}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Created: {new Date(trip.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRetakeTrip(trip)}
                          className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                        >
                          Take This Trip Again
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
