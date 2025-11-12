"use client";

import * as ScrollArea from "@radix-ui/react-scroll-area";
import { BusFront, Footprints } from "lucide-react";
import type { PlanItinerary } from "@/server/routing/service";

import { Skeleton } from "@/components/ui/skeleton";

interface ItineraryOptionsProps {
  itineraries?: PlanItinerary[] | null;
  planStatus: "idle" | "loading" | "success" | "error";
  planError: string | null;
  hasOrigin: boolean;
  onSelectItinerary?: (index: number, itinerary: PlanItinerary) => void;
}

function formatMinutes(value: number) {
  const rounded = Math.round(value);
  if (rounded <= 0) return "<1 min";
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  const kilometres = distanceMeters / 1000;
  const decimals = kilometres >= 10 ? 0 : 1;
  return `${kilometres.toFixed(decimals)} km`;
}

export function ItineraryOptions({
  itineraries,
  planStatus,
  planError,
  hasOrigin,
  onSelectItinerary,
}: ItineraryOptionsProps) {
  const statusMessage = (() => {
    switch (planStatus) {
      case "loading":
        return hasOrigin ? "Calculating best routes for your journey. This may take a moment…" : "Waiting for your location to plan the best route…";
      case "error":
        return planError ?? "Unable to calculate routes. Please check your connection and try again.";
      case "success":
        if (!itineraries?.length) {
          return "No routes found for this journey. Try selecting a different destination or starting point.";
        }
        return null;
      default:
        return "Select a destination to see suggested routes.";
    }
  })();

  if (planStatus === "loading") {
    return (
      <div className="flex-1 min-h-0">
        <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
          <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="w-full rounded-xl border bg-white p-4">
                  <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                    <div className="min-w-0 space-y-2">
                      <Skeleton className="h-7 w-24" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-md" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb className="rounded-full bg-border/60" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      </div>
    );
  }

  if (planStatus !== "success" || !itineraries?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-4">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{statusMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
        <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
          <div className="space-y-2 p-3">
            {itineraries.map((itinerary, index) => {
              const walkLegs = itinerary.legs.filter((leg) => leg.type === "walk");
              const busLegs = itinerary.legs.filter((leg) => leg.type === "bus");
              const totalWalkDistance = walkLegs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
              const stopCount = busLegs.reduce((sum, leg) => sum + (leg.stopCount ?? 1) - 1, 0);

              return (
                <button
                  key={`${itinerary.routeId ?? "walk"}-${index}`}
                  onClick={() => onSelectItinerary?.(index, itinerary)}
                  className="w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                    <div className="min-w-0">
                      <div className="text-xl sm:text-2xl font-bold text-foreground">
                        {formatMinutes(itinerary.totalDurationMinutes)}
                      </div>
                      <div className="mt-1 text-xs sm:text-sm text-muted-foreground">
                        {formatDistance(itinerary.totalDistanceMeters)} • {stopCount} {stopCount === 1 ? "stop" : "stops"}
                      </div>
                    </div>
                    {itinerary.routeNumber && (
                      <div className="text-right">
                        <span
                          className="block text-3xl sm:text-4xl md:text-5xl font-extrabold leading-none tracking-tighter tabular-nums"
                          style={{ color: itinerary.routeColor ? `#${itinerary.routeColor}` : "#2563eb" }}
                        >
                          {itinerary.routeNumber.includes("Route ")
                            ? itinerary.routeNumber.split("Route ")[1] ?? itinerary.routeNumber
                            : itinerary.routeNumber}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {busLegs.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <BusFront className="h-4 w-4" />
                        <span>{busLegs.length} {busLegs.length === 1 ? "ride" : "rides"}</span>
                      </div>
                    )}
                    {walkLegs.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Footprints className="h-4 w-4" />
                        <span>{formatDistance(totalWalkDistance)} walk</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-blue-600 font-medium">
                    View step-by-step directions →
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb className="rounded-full bg-border/60" />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner />
      </ScrollArea.Root>
    </div>
  );
}
