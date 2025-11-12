"use client";

import { useMemo } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Bus, MapPin, Bookmark } from "lucide-react";
import type { RouterOutputs } from "@/trpc/react";
import { api } from "@/trpc/react";
import { useSavedItems } from "@/trpc/saved-items";

type RouteDetails = RouterOutputs["bus"]["getRouteDetails"];

interface RouteDetailViewProps {
  route: RouterOutputs["bus"]["getRoutes"][number];
  routeDetails?: RouteDetails;
  onBack: () => void;
  requireAuth: (action: () => void | Promise<void>) => void;
}

interface StopWithBus {
  stop: RouteDetails["Stops"][number];
  nearestBus?: {
    vehicleId: number;
    eta: string;
    etaLocalTime: string;
    distanceMeters: number;
  };
}

export function RouteDetailView({
  route,
  routeDetails,
  onBack,
  requireAuth,
}: RouteDetailViewProps) {
  const savedItems = useSavedItems();
  const { data: stopDepartures } = api.bus.getStopDepartures.useQuery(
    { stopId: undefined },
    { refetchInterval: 30000 }
  );

  // Process stops with nearest bus info
  const stopsWithBuses = useMemo<StopWithBus[]>(() => {
    if (!routeDetails?.Stops || !stopDepartures) return [];

    return routeDetails.Stops.map((stop) => {
      // Find departures for this stop
      const stopInfo = stopDepartures.find((sd) => sd.StopId === stop.StopId);

      // Find departures for this specific route
      const routeDepartures =
        stopInfo?.RouteDirections.find(
          (rd) => rd.RouteId === route.RouteId.toString()
        )?.Departures ?? [];

      // Get nearest bus (earliest ETA)
      const nearestDeparture = routeDepartures
        .filter((dep) => !dep.IsCompleted)
        .sort(
          (a, b) =>
            new Date(a.ETALocalTime).getTime() -
            new Date(b.ETALocalTime).getTime()
        )[0];

      if (nearestDeparture) {
        // Calculate distance (if vehicle position available)
        // Match vehicle by BlockFareboxId since that's the common property
        const vehicle = routeDetails.Vehicles?.find(
          (v) => v.BlockFareboxId === nearestDeparture.Trip.BlockFareboxId
        );

        const distanceMeters = vehicle
          ? haversineDistance(
              { lat: vehicle.Latitude, lng: vehicle.Longitude },
              { lat: stop.Latitude, lng: stop.Longitude }
            )
          : 0;

        return {
          stop,
          nearestBus: {
            vehicleId: nearestDeparture.Trip.TripId,
            eta: nearestDeparture.ETA,
            etaLocalTime: nearestDeparture.ETALocalTime,
            distanceMeters,
          },
        };
      }

      return { stop };
    });
  }, [routeDetails, stopDepartures, route.RouteId]);

  const activeBusCount = routeDetails?.Vehicles?.length ?? 0;
  const isSaved = savedItems.routes.some(
    (r) => r.routeId === route.RouteId.toString()
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-muted"
        >
          ← Back
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{route.LongName}</div>
          <div className="text-xs text-muted-foreground">
            Route {route.ShortName} • {activeBusCount} active{" "}
            {activeBusCount === 1 ? "bus" : "buses"}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            requireAuth(async () => {
              const button = e.currentTarget;
              button.disabled = true;

              try {
                if (isSaved) {
                  const savedRoute = savedItems.routes.find(
                    (r) => r.routeId === route.RouteId.toString()
                  );
                  if (savedRoute) {
                    await savedItems.remove(savedRoute.id);
                  }
                } else {
                  await savedItems.saveRoute(
                    route.RouteId.toString(),
                    route.LongName
                  );
                }
              } finally {
                button.disabled = false;
              }
            });
          }}
          aria-label={isSaved ? "Remove saved route" : "Save route"}
          className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isSaved
              ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "border-border/70 text-muted-foreground hover:bg-muted"
          }`}
        >
          <Bookmark
            className="h-4 w-4"
            fill={isSaved ? "currentColor" : "none"}
          />
        </button>
      </div>

      {/* Stop Timeline */}
      <div className="min-h-0 flex-1">
        <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
          <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
            <div className="p-4">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute bottom-0 left-4 top-0 w-0.5 bg-border" />

                {/* Stops */}
                <div className="space-y-6">
                  {stopsWithBuses.map((item, index) => {
                    const isFirst = index === 0;
                    const isLast = index === stopsWithBuses.length - 1;
                    const hasNearbyBus = !!item.nearestBus;

                    return (
                      <div key={item.stop.StopId} className="relative pl-10">
                        {/* Stop marker */}
                        <div
                          className={`absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                            hasNearbyBus
                              ? "border-orange-500 bg-orange-100"
                              : isFirst || isLast
                                ? "border-blue-500 bg-blue-100"
                                : "border-border bg-white"
                          }`}
                        >
                          <MapPin
                            className={`h-4 w-4 ${
                              hasNearbyBus
                                ? "text-orange-600"
                                : "text-muted-foreground"
                            }`}
                          />
                        </div>

                        {/* Stop info */}
                        <div>
                          <div className="text-sm font-medium">
                            {item.stop.Name}
                          </div>

                          {item.nearestBus && (
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              <Bus className="h-3.5 w-3.5 text-orange-600" />
                              <span className="font-semibold text-orange-600">
                                {formatETA(item.nearestBus.etaLocalTime)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            className="flex touch-none select-none p-0.5"
            orientation="vertical"
          >
            <ScrollArea.Thumb className="relative flex-1 rounded-full bg-border/60" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>
    </div>
  );
}

// Helper function to calculate distance between two coordinates
function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const a_calc =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a_calc), Math.sqrt(1 - a_calc));

  return R * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function formatETA(etaLocalTime: string): string {
  try {
    const etaDate = new Date(etaLocalTime);
    const now = new Date();
    const diffMinutes = Math.round(
      (etaDate.getTime() - now.getTime()) / 60000
    );

    if (diffMinutes <= 0) return "Now";
    if (diffMinutes === 1) return "1 min";
    if (diffMinutes < 60) return `${diffMinutes} mins`;

    return etaDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Unknown";
  }
}
