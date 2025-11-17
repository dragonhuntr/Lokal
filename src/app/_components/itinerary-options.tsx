"use client";

import * as ScrollArea from "@radix-ui/react-scroll-area";
import { BusFront, Footprints, Clock } from "lucide-react";
import type { PlanItinerary } from "@/server/routing/service";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateItineraryTimes, calculateMultiStopJourneyTimes } from "./utils/itinerary-times";
import { formatMinutes, formatDistance, formatTime } from "@/utils/format";

interface ItineraryOptionsProps {
  itineraries?: PlanItinerary[] | null;
  planStatus: "idle" | "loading" | "success" | "error";
  planError: string | null;
  hasOrigin: boolean;
  selectedItineraryIndex?: number;
  onSelectItinerary?: (index: number, itinerary: PlanItinerary) => void;
  lockedItinerary?: PlanItinerary | null;
  isItineraryLocked?: boolean;
  onLockItinerary?: (index: number, itinerary: PlanItinerary) => void;
  onUnlockItinerary?: () => void;
}

export function ItineraryOptions({
  itineraries,
  planStatus,
  planError,
  hasOrigin,
  selectedItineraryIndex = 0,
  onSelectItinerary,
  lockedItinerary,
  isItineraryLocked = false,
  onLockItinerary,
  onUnlockItinerary,
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

              // Use multi-stop calculation if stops are present, otherwise use basic calculation
              const hasStops = itinerary.stops && itinerary.stops.length > 0;
              const multiStopTimes = hasStops ? calculateMultiStopJourneyTimes(itinerary) : null;
              const basicTimes = calculateItineraryTimes(itinerary);

              const startTime = multiStopTimes?.startTime ?? basicTimes.startTime;
              const arrivalTime = multiStopTimes?.finalArrivalTime ?? basicTimes.arrivalTime;
              const displayedDurationMinutes = multiStopTimes?.totalTravelMinutes ?? basicTimes.displayedDurationMinutes;
              const bufferMinutes = multiStopTimes?.totalBufferMinutes ?? 0;

              const isThisLocked = isItineraryLocked && lockedItinerary === itinerary;
              const isSelected = selectedItineraryIndex === index;

              return (
                <div
                  key={`${itinerary.routeId ?? "walk"}-${index}`}
                  className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-all duration-200 ${
                    isThisLocked
                      ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-500/20"
                      : "hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  <button
                    onClick={() => !isThisLocked && onSelectItinerary?.(index, itinerary)}
                    className="w-full text-left"
                    disabled={isThisLocked}
                  >
                    {isThisLocked && (
                      <div className="mb-2 flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Selected Route
                      </div>
                    )}
                    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                      <div className="min-w-0">
                        <div className="text-xl sm:text-2xl font-bold text-foreground">
                          {formatMinutes(displayedDurationMinutes)}
                        </div>
                        <div className="mt-1 text-xs sm:text-sm text-muted-foreground">
                          {formatDistance(itinerary.totalDistanceMeters)} • {stopCount} {stopCount === 1 ? "stop" : "stops"}
                        </div>
                        {startTime && arrivalTime && (
                          <div className="mt-1 text-xs sm:text-sm font-medium text-foreground">
                            {formatTime(startTime)} → {formatTime(arrivalTime)}
                          </div>
                        )}
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
                      {bufferMinutes > 0 && (
                        <div className="flex items-center gap-1.5 text-amber-700">
                          <Clock className="h-4 w-4" />
                          <span>{formatMinutes(bufferMinutes)} buffer</span>
                        </div>
                      )}
                    </div>

                    {!isThisLocked && (
                      <div className="mt-3 text-xs text-blue-600 font-medium">
                        View step-by-step directions →
                      </div>
                    )}
                  </button>

                  {isSelected && !isThisLocked && onLockItinerary && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLockItinerary(index, itinerary);
                        }}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        Select this route
                      </button>
                    </div>
                  )}

                  {isThisLocked && onUnlockItinerary && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnlockItinerary();
                        }}
                        className="flex-1 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        Change route
                      </button>
                    </div>
                  )}
                </div>
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
