"use client";

import { useMemo } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { MapPin, Search, X } from "lucide-react";
import type { LocationSearchResult } from "./routes-sidebar";

interface PlaceResult {
  mapboxId: string;
  name: string;
  placeName: string;
  address?: string;
  context: string[];
  distanceMeters?: number;
  location?: LocationSearchResult;
}

interface PlaceSearchProps {
  placeQuery: string;
  onPlaceQueryChange: (query: string) => void;
  placeResults: PlaceResult[];
  isLoading: boolean;
  error: string | null;
  userLocation?: { latitude: number; longitude: number } | null;
  journeyStops: LocationSearchResult[];
  journeyStopIds: Set<string>;
  finalStopId: string | null;
  hasOrigin: boolean;
  manualOrigin?: LocationSearchResult | null;
  planStatus: "idle" | "loading" | "success" | "error";
  onAddPlace: (place: PlaceResult) => void;
  onPlanJourney?: () => void;
  onSetManualOrigin?: (location: LocationSearchResult | null) => void;
}

function distanceBetweenMeters(
  origin: { latitude: number; longitude: number },
  target: { latitude: number; longitude: number }
) {
  const EARTH_RADIUS_METERS = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(target.latitude);
  const deltaLat = toRadians(target.latitude - origin.latitude);
  const deltaLon = toRadians(target.longitude - origin.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  const kilometres = distanceMeters / 1000;
  const decimals = kilometres >= 10 ? 0 : 1;
  return `${kilometres.toFixed(decimals)} km`;
}

export function PlaceSearch({
  placeQuery,
  onPlaceQueryChange,
  placeResults,
  isLoading,
  error,
  userLocation,
  journeyStops,
  journeyStopIds,
  finalStopId,
  hasOrigin,
  manualOrigin,
  planStatus,
  onAddPlace,
  onPlanJourney,
  onSetManualOrigin,
}: PlaceSearchProps) {
  const placesWithDistance = useMemo(() => {
    return placeResults
      .map((result) => {
        if (result.distanceMeters !== undefined) {
          return result;
        }

        if (!userLocation || !result.location) {
          return result;
        }

        const distanceMeters = distanceBetweenMeters(userLocation, {
          latitude: result.location.latitude,
          longitude: result.location.longitude,
        });

        return { ...result, distanceMeters };
      })
      .sort((a, b) => {
        const aDistance = a.distanceMeters ?? Number.POSITIVE_INFINITY;
        const bDistance = b.distanceMeters ?? Number.POSITIVE_INFINITY;
        return aDistance - bDistance;
      });
  }, [placeResults, userLocation]);

  const statusMessage = useMemo(() => {
    if (!placeQuery.trim()) return "Search for a building or location.";
    if (error) return error;
    if (isLoading) return "Searching…";
    if (!placeResults.length) return "No places found.";
    return `${placeResults.length} places`;
  }, [placeQuery, error, isLoading, placeResults.length]);

  return (
    <>
      <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2">
        <Search className="h-4 w-4 opacity-60" />
        <input
          value={placeQuery}
          onChange={(event) => onPlaceQueryChange(event.target.value)}
          placeholder="Search locations or buildings…"
          className="h-9 w-full bg-transparent text-sm outline-none"
        />
      </div>

      {!hasOrigin && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900 mb-2">
            {userLocation ? "Using your GPS location" : "Set your starting location to plan a journey"}
          </p>
          {!userLocation && placeResults.length > 0 && (
            <button
              onClick={() => {
                if (placeResults[0]?.location) {
                  onSetManualOrigin?.(placeResults[0].location);
                }
              }}
              className="text-xs text-amber-700 underline hover:text-amber-900"
            >
              Or search for your starting location above
            </button>
          )}
        </div>
      )}

      {journeyStops.length > 0 && planStatus === "idle" && (
        <button
          type="button"
          onClick={() => onPlanJourney?.()}
          className="mb-3 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          disabled={!hasOrigin}
        >
          {hasOrigin ? `Plan Journey (${journeyStops.length} stop${journeyStops.length === 1 ? "" : "s"})` : "Set starting location to plan"}
        </button>
      )}

      {manualOrigin && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="h-3 w-3 text-blue-600" />
            <span className="text-blue-900">Starting from: {manualOrigin.name}</span>
          </div>
          <button
            onClick={() => onSetManualOrigin?.(null)}
            className="text-blue-600 hover:text-blue-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-2 flex items-center gap-2 text-xs opacity-60">
        {isLoading && (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        )}
        <span>{statusMessage}</span>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
          <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
            <ul className="space-y-2 p-2 pr-3">
              {placesWithDistance.map((place) => {
                const identifiedLocation = place.location;
                const summaryContext = place.context.join(" • ");
                const subtitle =
                  place.address ??
                  (summaryContext.length > 0 ? summaryContext : place.placeName);
                const fallbackDistance =
                  userLocation && identifiedLocation
                    ? distanceBetweenMeters(userLocation, {
                        latitude: identifiedLocation.latitude,
                        longitude: identifiedLocation.longitude,
                      })
                    : undefined;
                const computedDistanceMeters = place.distanceMeters ?? fallbackDistance;
                const formattedDistance =
                  computedDistanceMeters !== undefined
                    ? `${formatDistance(computedDistanceMeters)} away`
                    : undefined;
                const distanceLabel = formattedDistance ?? "Distance unavailable";
                const isJourneyStop = identifiedLocation
                  ? journeyStopIds.has(identifiedLocation.id)
                  : journeyStopIds.has(place.mapboxId);
                const isFinalStop = Boolean(
                  finalStopId &&
                    ((identifiedLocation && identifiedLocation.id === finalStopId) ??
                      place.mapboxId === finalStopId)
                );
                const highlightClass = isFinalStop
                  ? "border-blue-500 ring-2 ring-blue-500/40 bg-blue-50"
                  : isJourneyStop
                    ? "border-blue-300/60 bg-blue-50/40"
                    : "";

                return (
                  <li key={place.mapboxId}>
                    <button
                      className={`relative w-full max-w-full overflow-hidden rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                        highlightClass
                      }`}
                      aria-pressed={isJourneyStop}
                      onClick={() => onAddPlace(place)}
                      title={place.placeName}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-muted-foreground">
                            {subtitle}
                          </div>
                          <div className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
                            {place.name}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{place.placeName}</span>
                            <span>&middot;</span>
                            <span>{distanceLabel}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb className="rounded-full bg-border/60" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      </div>
    </>
  );
}
