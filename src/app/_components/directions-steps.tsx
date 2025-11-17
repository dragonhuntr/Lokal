"use client";

import { useEffect, useMemo, useState } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { ArrowLeft, Bookmark, BusFront, ChevronDown, ChevronUp, Clock, Footprints, MapPin, Share2 } from "lucide-react";
import type { PlanItinerary } from "@/server/routing/service";
import type { LocationSearchResult } from "./routes-sidebar";
import { useSavedItems } from "@/trpc/saved-items";
import { calculateItineraryTimes } from "./utils/itinerary-times";
import { formatMinutes, formatShareMinutes, formatDistance, formatTime } from "@/utils/format";

interface DirectionsStepsProps {
  itinerary?: PlanItinerary | null;
  activeDestination?: LocationSearchResult | null;
  requireAuth: (action: () => void | Promise<void>) => void;
  onSaveJourney: (itinerary: PlanItinerary, nickname?: string, destinationName?: string) => Promise<void>;
  viewingSavedJourney?: boolean;
  sharedJourneyDestinationName?: string | null;
  onBackToSavedItems?: () => void;
}

function getDataSourceLabel(dataSource?: string): string {
  switch (dataSource) {
    case "realtime":
      return "Real-time";
    case "scheduled":
      return "Scheduled";
    case "estimated":
    default:
      return "Estimated";
  }
}

function getDataSourceColor(dataSource?: string): string {
  switch (dataSource) {
    case "realtime":
      return "text-green-600";
    case "scheduled":
      return "text-blue-600";
    case "estimated":
    default:
      return "text-gray-600";
  }
}

export function DirectionsSteps({
  itinerary,
  activeDestination,
  requireAuth,
  onSaveJourney,
  viewingSavedJourney = false,
  sharedJourneyDestinationName = null,
  onBackToSavedItems,
}: DirectionsStepsProps) {
  const savedItems = useSavedItems();
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [justRemoved, setJustRemoved] = useState(false);
  const [expandedStops, setExpandedStops] = useState<Set<number>>(new Set());

  const matchingSavedJourney = useMemo(() => {
    if (!itinerary) return null;
    return savedItems.journeys.find((j) => {
      // Compare key properties instead of full JSON.stringify for better reliability
      const saved = j.itineraryData;
      if (!saved) return false;
      
      // Compare total duration and distance as quick checks
      if (
        Math.abs(saved.totalDurationMinutes - itinerary.totalDurationMinutes) > 0.1 ||
        Math.abs(saved.totalDistanceMeters - itinerary.totalDistanceMeters) > 1
      ) {
        return false;
      }
      
      // Compare number of legs
      if (saved.legs?.length !== itinerary.legs?.length) {
        return false;
      }
      
      // Deep comparison of legs
      return JSON.stringify(saved) === JSON.stringify(itinerary);
    }) ?? null;
  }, [itinerary, savedItems.journeys]);

  // Clear justSaved flag once the saved journey is found in the refetched data
  useEffect(() => {
    if (justSaved && matchingSavedJourney) {
      setJustSaved(false);
    }
  }, [justSaved, matchingSavedJourney]);

  // Clear justRemoved flag once the saved journey is no longer found after removal
  useEffect(() => {
    if (justRemoved && !matchingSavedJourney) {
      setJustRemoved(false);
    }
  }, [justRemoved, matchingSavedJourney]);

  if (!itinerary) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-4 text-xs text-muted-foreground">
        No route selected
      </div>
    );
  }

  const isSaved = (!!matchingSavedJourney || justSaved) && !justRemoved;
  const isSharedJourney = viewingSavedJourney && !matchingSavedJourney;

  // Get destination name: prefer shared journey destination name, then activeDestination, fall back to last leg's end stop name
  const lastLeg = itinerary.legs.length > 0 ? itinerary.legs[itinerary.legs.length - 1] : null;
  const destinationName = sharedJourneyDestinationName
    ?? activeDestination?.name
    ?? activeDestination?.placeName
    ?? lastLeg?.endStopName
    ?? lastLeg?.end?.stopName
    ?? "Your destination";

  const { startTime, arrivalTime, displayedDurationMinutes } = calculateItineraryTimes(itinerary);

  return (
    <div className="flex-1 min-h-0">
      <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
        <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
          <div className="space-y-3 p-3">
            {/* Back to Saved Items button - only show for saved journeys, not shared */}
            {viewingSavedJourney && !isSharedJourney && onBackToSavedItems && (
              <button
                type="button"
                onClick={onBackToSavedItems}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Saved Items
              </button>
            )}

            {/* Journey Summary Card */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {formatMinutes(displayedDurationMinutes)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatDistance(itinerary.totalDistanceMeters)} total
                  </div>
                  {startTime && arrivalTime && (
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {formatTime(startTime)} → {formatTime(arrivalTime)}
                    </div>
                  )}
                </div>
                {/* Only show action buttons if not viewing a shared journey */}
                {!isSharedJourney && (
                  <div className="flex items-center gap-2">
                    {matchingSavedJourney && (
                      <button
                        type="button"
                        onClick={async () => {
                          const shareUrl = `${window.location.origin}/journey/${matchingSavedJourney.id}`;
                          const message = `View my Journey on Lokal! ETA to ${destinationName} is ${formatShareMinutes(displayedDurationMinutes)}. ${shareUrl}`;

                          try {
                            if (navigator.clipboard?.writeText) {
                              await navigator.clipboard.writeText(message);
                              setShareSuccess(true);
                              setTimeout(() => setShareSuccess(false), 2000);
                            } else {
                              throw new Error("Clipboard API unavailable");
                            }
                          } catch (error) {
                            console.error("Failed to copy journey share link", error);
                            alert("Unable to copy share link. Please copy it manually: " + shareUrl);
                          }
                        }}
                        aria-label="Share journey"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-purple-200 bg-white px-4 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-50"
                      >
                        <Share2 className="h-4 w-4" />
                        {shareSuccess ? "Copied!" : "Share"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        requireAuth(async () => {
                          const button = e.currentTarget;
                          button.disabled = true;
                          setIsSaving(true);
                          setJustSaved(false);

                          try {
                            if (isSaved && matchingSavedJourney) {
                              await savedItems.remove(matchingSavedJourney.id);
                              setJustRemoved(true);
                              // Refetch to update the UI
                              await savedItems.refetch();
                            } else if (itinerary) {
                              const nickname = activeDestination?.name ?? activeDestination?.placeName ?? undefined;
                              const destinationName = activeDestination?.name ?? activeDestination?.placeName ?? lastLeg?.endStopName ?? undefined;
                              await onSaveJourney(itinerary, nickname, destinationName);
                              setJustSaved(true);
                              setJustRemoved(false);
                              // Refetch to update the UI
                              await savedItems.refetch();
                            }
                          } finally {
                            button.disabled = false;
                            setIsSaving(false);
                          }
                        });
                      }}
                      aria-label={isSaved ? "Remove from saved" : "Save journey"}
                      disabled={isSaving}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSaved
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-blue-300 text-blue-600 hover:bg-blue-100"
                      }`}
                    >
                      <Bookmark className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step-by-step directions */}
            <div className="space-y-2">
              {itinerary.legs.map((leg, legIndex) => {
                const isWalk = leg.type === "walk";
                const isFirstLeg = legIndex === 0;
                const isLastLeg = legIndex === itinerary.legs.length - 1;

                // Find if this leg ends at a stop with buffer time
                // For multi-stop journeys, stops array has origin at index 0, then destinations
                // We need to match the leg end with a stop that has buffer
                const legEndStop = itinerary.stops?.find((stop, stopIndex) => {
                  // Skip origin (sequence 0) and final destination
                  if (stop.sequence === 0 || stopIndex === itinerary.stops!.length - 1) return false;

                  // Check if this stop's location matches the leg's end location
                  const endsAtStop =
                    leg.end &&
                    Math.abs(leg.end.latitude - stop.latitude) < 0.0001 &&
                    Math.abs(leg.end.longitude - stop.longitude) < 0.0001;

                  return endsAtStop && stop.bufferMinutes > 0;
                });

                // Calculate leg start and end times sequentially
                // Each leg starts when the previous leg ends
                let legStartTime: Date | null = null;
                let legEndTime: Date | null = null;
                
                if (startTime) {
                  // Calculate cumulative time up to this leg
                  let currentTime = new Date(startTime);

                  for (let i = 0; i < legIndex; i++) {
                    const prevLeg = itinerary.legs[i];
                    if (!prevLeg) continue;

                    if (prevLeg.type === "bus" && prevLeg.departureTime) {
                      // Bus leg with departure time - use actual departure time
                      const busDeparture = new Date(prevLeg.departureTime);
                      // Update current time to bus departure + bus duration
                      currentTime = new Date(busDeparture.getTime() + prevLeg.durationMinutes * 60 * 1000);
                    } else {
                      // Walk leg or bus without departure time - add duration
                      currentTime = new Date(currentTime.getTime() + prevLeg.durationMinutes * 60 * 1000);
                      // Add wait time if present (for bus legs without departure time)
                      if (prevLeg.waitTimeMinutes) {
                        currentTime = new Date(currentTime.getTime() + prevLeg.waitTimeMinutes * 60 * 1000);
                      }
                    }

                    // Check if this leg ends at a stop with buffer time and add it to cumulative time
                    const prevLegEndStop = itinerary.stops?.find((stop, stopIndex) => {
                      // Skip origin (sequence 0) and final destination
                      if (stop.sequence === 0 || stopIndex === itinerary.stops!.length - 1) return false;

                      // Check if this stop's location matches the leg's end location
                      const endsAtStop =
                        prevLeg.end &&
                        Math.abs(prevLeg.end.latitude - stop.latitude) < 0.0001 &&
                        Math.abs(prevLeg.end.longitude - stop.longitude) < 0.0001;

                      return endsAtStop && stop.bufferMinutes > 0;
                    });

                    if (prevLegEndStop && prevLegEndStop.bufferMinutes > 0) {
                      currentTime = new Date(currentTime.getTime() + prevLegEndStop.bufferMinutes * 60 * 1000);
                    }
                  }
                  
                  // Set start time for current leg
                  if (!isWalk && leg.departureTime) {
                    // Bus leg with departure time - use actual departure time
                    legStartTime = new Date(leg.departureTime);
                  } else {
                    // Walk leg or bus without departure time - start after previous leg ends
                    legStartTime = new Date(currentTime);
                  }
                  
                  // Calculate end time
                  legEndTime = new Date(legStartTime.getTime() + leg.durationMinutes * 60 * 1000);
                }

                return (
                  <>
                    <div
                      key={legIndex}
                      className="rounded-xl border bg-white p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                            isWalk ? "bg-blue-100" : "bg-orange-100"
                          }`}
                        >
                        {isWalk ? (
                          <Footprints className="h-5 w-5 text-blue-600" />
                        ) : (
                          <BusFront className="h-5 w-5 text-orange-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isWalk ? (
                          <>
                            <div className="font-semibold text-foreground">
                              {isFirstLeg
                                ? leg.endStopName
                                  ? `Walk to ${leg.endStopName}`
                                  : "Walk to bus stop"
                                : isLastLeg
                                ? "Walk to destination"
                                : "Walk to next stop"}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {formatDistance(leg.distanceMeters)} • {formatMinutes(leg.durationMinutes)}
                              {legStartTime && legEndTime && (
                                <span className="ml-2">• {formatTime(legStartTime)} → {formatTime(legEndTime)}</span>
                              )}
                            </div>
                            {leg.endStopName && !isLastLeg && (
                              <div className="mt-2 text-sm">
                                <span className="font-medium">To:</span>{" "}
                                {leg.endStopName}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-foreground">
                              Take {leg.routeName ?? `Route ${leg.routeNumber ?? ""}`}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {(() => {
                                const hopCount = Math.max((leg.stopCount ?? 1) - 1, 0);
                                const stopLabel =
                                  hopCount <= 0
                                    ? "non-stop"
                                    : hopCount === 1
                                    ? "1 stop"
                                    : `${hopCount} stops`;
                                return `${stopLabel} • ${formatMinutes(leg.durationMinutes)}`;
                              })()}
                              {legStartTime && legEndTime && (
                                <span className="ml-2">• {formatTime(legStartTime)} → {formatTime(legEndTime)}</span>
                              )}
                            </div>
                            {leg.departureTime && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                Bus departs at {formatTime(leg.departureTime)}
                                {leg.dataSource && (
                                  <span className={`ml-2 ${getDataSourceColor(leg.dataSource)}`}>
                                    ({getDataSourceLabel(leg.dataSource)})
                                  </span>
                                )}
                              </div>
                            )}
                            {leg.startStopName && (
                              <div className="mt-2 text-sm">
                                <span className="font-medium">From:</span>{" "}
                                {leg.startStopName}
                              </div>
                            )}
                            {leg.endStopName && (
                              <div className="mt-1 text-sm">
                                <span className="font-medium">To:</span>{" "}
                                {leg.endStopName}
                              </div>
                            )}
                            {leg.path && leg.path.length > 0 && (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedStops((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(legIndex)) {
                                        next.delete(legIndex);
                                      } else {
                                        next.add(legIndex);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                >
                                  <span>
                                    View all stops ({leg.path.length})
                                  </span>
                                  {expandedStops.has(legIndex) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </button>
                                {expandedStops.has(legIndex) && (
                                  <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
                                    <div className="relative">
                                      {/* Vertical line connecting stops */}
                                      <div 
                                        className="absolute bottom-0 top-0 left-2 w-4 rounded-full" 
                                        style={{ backgroundColor: leg.routeColor ? `#${leg.routeColor}` : "#2563eb" }}
                                      />
                                      
                                      {/* Stops list */}
                                      <div className="space-y-4">
                                        {leg.path.map((stop, stopIndex) => {
                                          const isFirst = stopIndex === 0;
                                          const isLast = stopIndex === leg.path!.length - 1;
                                          const routeColor = leg.routeColor ? `#${leg.routeColor}` : "#2563eb";
                                          
                                          return (
                                            <div
                                              key={stop.stopId ?? stopIndex}
                                              className="relative pl-10"
                                            >
                                              {/* Stop marker circle */}
                                              <div className="absolute left-4 top-0 flex h-8 w-8 -translate-x-1/2 items-center justify-center">
                                                <div
                                                  className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                                                    isFirst || isLast
                                                      ? "border-blue-500 bg-blue-100"
                                                      : "border-gray-300 bg-white"
                                                  }`}
                                                  style={
                                                    isFirst || isLast
                                                      ? undefined
                                                      : {
                                                          borderColor: routeColor,
                                                          backgroundColor: "#ffffff",
                                                        }
                                                  }
                                                >
                                                  <MapPin
                                                    className={`h-4 w-4 ${
                                                      isFirst || isLast
                                                        ? "text-blue-600"
                                                        : "text-gray-500"
                                                    }`}
                                                    style={
                                                      !(isFirst || isLast)
                                                        ? {
                                                            color: routeColor,
                                                          }
                                                        : undefined
                                                    }
                                                  />
                                                </div>
                                              </div>
                                              
                                              {/* Stop info */}
                                              <div>
                                                <div className={`text-sm font-medium ${
                                                  isFirst || isLast ? "text-blue-900" : "text-gray-700"
                                                }`}>
                                                  {stop.stopName ?? `Stop ${stopIndex + 1}`}
                                                </div>
                                                {(isFirst || isLast) && (
                                                  <div className="mt-1">
                                                    {isFirst && (
                                                      <span className="inline-block rounded bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-800">
                                                        Boarding
                                                      </span>
                                                    )}
                                                    {isLast && (
                                                      <span className="inline-block rounded bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
                                                        Get off
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        </div>
                      </div>
                    </div>

                    {/* Buffer time card - shown if this leg ends at a stop with buffer */}
                    {legEndStop && legEndStop.bufferMinutes > 0 && (
                      <div
                        key={`buffer-${legIndex}`}
                        className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                            <Clock className="h-5 w-5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground">
                              {formatMinutes(legEndStop.bufferMinutes)} buffer
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {legEndStop.purpose
                                ? legEndStop.purpose
                                : `Time to spend at ${legEndStop.name}`
                              }
                            </div>
                            {legEndStop.arrivalTime && legEndStop.departureTime && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatTime(legEndStop.arrivalTime)} → {formatTime(legEndStop.departureTime)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })}
            </div>

            {/* Arrival info */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <div className="text-sm font-medium text-green-900">
                You&apos;ll arrive at {destinationName}
              </div>
              {arrivalTime && (
                <div className="mt-1 text-base font-semibold text-green-800">
                  {formatTime(arrivalTime)}
                </div>
              )}
            </div>
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
