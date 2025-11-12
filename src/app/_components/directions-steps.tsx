"use client";

import { useEffect, useMemo, useState } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { ArrowLeft, Bookmark, BusFront, Footprints, Share2 } from "lucide-react";
import type { PlanItinerary } from "@/server/routing/service";
import type { LocationSearchResult } from "./routes-sidebar";
import { useSavedItems } from "@/trpc/saved-items";

interface DirectionsStepsProps {
  itinerary?: PlanItinerary | null;
  activeDestination?: LocationSearchResult | null;
  requireAuth: (action: () => void | Promise<void>) => void;
  onSaveJourney: (itinerary: PlanItinerary, nickname?: string, destinationName?: string) => Promise<void>;
  viewingSavedJourney?: boolean;
  sharedJourneyDestinationName?: string | null;
  onBackToSavedItems?: () => void;
}

function formatMinutes(value: number) {
  const rounded = Math.round(value);
  if (rounded <= 0) return "<1 min";
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
}

function formatShareMinutes(value: number) {
  const rounded = Math.max(1, Math.round(value));
  return `${rounded} minute${rounded === 1 ? "" : "s"}`;
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  const kilometres = distanceMeters / 1000;
  const decimals = kilometres >= 10 ? 0 : 1;
  return `${kilometres.toFixed(decimals)} km`;
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

  if (!itinerary) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-4 text-xs text-muted-foreground">
        No route selected
      </div>
    );
  }

  const isSaved = (!!matchingSavedJourney || justSaved) && !justRemoved;
  const isSharedJourney = viewingSavedJourney && !matchingSavedJourney;

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

  // Get destination name: prefer shared journey destination name, then activeDestination, fall back to last leg's end stop name
  const lastLeg = itinerary.legs.length > 0 ? itinerary.legs[itinerary.legs.length - 1] : null;
  const destinationName = sharedJourneyDestinationName
    ?? activeDestination?.name
    ?? activeDestination?.placeName
    ?? lastLeg?.endStopName
    ?? lastLeg?.end?.stopName
    ?? "Your destination";

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
                    {formatMinutes(itinerary.totalDurationMinutes)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatDistance(itinerary.totalDistanceMeters)} total
                  </div>
                </div>
                {/* Only show action buttons if not viewing a shared journey */}
                {!isSharedJourney && (
                  <div className="flex items-center gap-2">
                    {matchingSavedJourney && (
                      <button
                        type="button"
                        onClick={async () => {
                          const shareUrl = `${window.location.origin}/journey/${matchingSavedJourney.id}`;
                          const message = `View my Journey on Lokal! ETA to ${destinationName} is ${formatShareMinutes(itinerary.totalDurationMinutes)}. ${shareUrl}`;

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

                return (
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
                                ? "Walk to bus stop"
                                : isLastLeg
                                ? "Walk to destination"
                                : "Walk to next stop"}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {formatDistance(leg.distanceMeters)} • {formatMinutes(leg.durationMinutes)}
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
                            </div>
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Arrival info */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <div className="text-sm font-medium text-green-900">
                You&apos;ll arrive at your destination
              </div>
              <div className="mt-1 text-lg font-bold text-green-900">
                {destinationName}
              </div>
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
