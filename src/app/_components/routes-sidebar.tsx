"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Menu, X, Search, MapPin, Bus, Footprints, BusFront, ArrowLeft } from "lucide-react";
import { env } from "@/env";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/react";
import type { PlanItinerary } from "@/server/routing/service";

const RESULT_LIMIT = 10; // RANGE IS 0 TO 10
const DEBOUNCE_MS = 300;
const EARTH_RADIUS_METERS = 6_371_000;

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];

export interface LocationSearchResult {
  id: string;
  name: string;
  placeName: string;
  latitude: number;
  longitude: number;
  address?: string;
  context: string[];
}

type SidebarView = "routes" | "places" | "itineraries";

type PlanStatus = "idle" | "loading" | "success" | "error";

interface RoutesSidebarProps {
  selectedRouteId?: number;
  onSelectRoute?: (route: RouteSummary) => void;
  selectedLocationId?: string;
  selectedLocation?: LocationSearchResult | null;
  onSelectLocation?: (location: LocationSearchResult) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  hasOrigin?: boolean;
  itineraries?: PlanItinerary[] | null;
  planStatus?: PlanStatus;
  planError?: string | null;
  selectedItineraryIndex?: number;
  onSelectItinerary?: (index: number, itinerary: PlanItinerary) => void;
}

type ContextEntry =
  | {
      name?: string | null;
      [key: string]: unknown;
    }
  | null
  | undefined;

type SuggestionContextInput =
  | ContextEntry[]
  | Record<string, ContextEntry | ContextEntry[] | null | undefined>
  | null
  | undefined;

function extractContextNames(context: SuggestionContextInput): string[] {
  if (!context) return [];

  const entries: ContextEntry[] = [];

  if (Array.isArray(context)) {
    entries.push(...context);
  } else {
    const values = Object.values(
      context as Record<string, ContextEntry | ContextEntry[] | null | undefined>
    );
    for (const value of values) {
      if (!value) continue;
      if (Array.isArray(value)) {
        entries.push(...value);
      } else {
        entries.push(value);
      }
    }
  }

  const names = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const name = entry.name;
    if (typeof name === "string" && name.trim().length > 0) {
      names.add(name);
    }
  }

  return Array.from(names);
}

function distanceBetweenMeters(origin: { latitude: number; longitude: number }, target: { latitude: number; longitude: number }) {
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

export function RoutesSidebar({
  selectedRouteId,
  onSelectRoute,
  selectedLocationId,
  selectedLocation,
  onSelectLocation,
  userLocation,
  hasOrigin = false,
  itineraries,
  planStatus = "idle",
  planError = null,
  selectedItineraryIndex = 0,
  onSelectItinerary,
}: RoutesSidebarProps) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<SidebarView>("routes");
  const [routeQuery, setRouteQuery] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const sessionTokenRef = useRef<string | null>(null);
  const previousLocationIdRef = useRef<string | null>(null);

  const { data: routes, isLoading: areRoutesLoading } = api.bus.getRoutes.useQuery();

  useEffect(() => {
    const previousId = previousLocationIdRef.current;
    const currentId = selectedLocation?.id ?? null;

    if (currentId && currentId !== previousId) {
      setView("itineraries");
    } else if (!currentId && previousId && view === "itineraries") {
      setView("places");
    }

    previousLocationIdRef.current = currentId;
  }, [selectedLocation, view]);

  const ensureSessionToken = useCallback(() => {
    if (sessionTokenRef.current) return sessionTokenRef.current;
    const token =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionTokenRef.current = token;
    return token;
  }, []);

  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  useEffect(() => {
    if (view !== "places") return;

    const trimmed = placeQuery.trim();
    if (!trimmed) {
      setPlaceResults([]);
      setPlacesError(null);
      setIsPlacesLoading(false);
      return;
    }

    const controller = new AbortController();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    const timeoutId = window.setTimeout(async () => {
      setIsPlacesLoading(true);
      try {
        const sessionToken = ensureSessionToken();
        const params = new URLSearchParams({
          q: trimmed,
          types: "poi,address",
          limit: String(RESULT_LIMIT),
          session_token: sessionToken,
          access_token: env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
        });
        if (userLocation) {
          params.set("origin", `${userLocation.longitude},${userLocation.latitude}`);
        }

        const response = await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Mapbox Search Box error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as SearchBoxSuggestResponse;

        if (requestId !== requestIdRef.current) {
          return;
        }

        const mapped =
          data.suggestions?.map<PlaceResult>((suggestion) => {
            const { mapbox_id: mapboxId } = suggestion;
            const coordinates = suggestion.coordinates
              ? { latitude: suggestion.coordinates.latitude, longitude: suggestion.coordinates.longitude }
              : null;
            const contextNames = extractContextNames(suggestion.context);

            const location: LocationSearchResult | null = coordinates
              ? {
                  id: mapboxId,
                  name: suggestion.name ?? trimmed,
                  placeName: suggestion.place_formatted ?? suggestion.full_address ?? suggestion.name ?? trimmed,
                  latitude: coordinates.latitude,
                  longitude: coordinates.longitude,
                  address: suggestion.full_address ?? suggestion.address,
                  context: contextNames,
                }
              : null;

            return {
              mapboxId,
              name: suggestion.name ?? trimmed,
              placeName: suggestion.place_formatted ?? suggestion.full_address ?? suggestion.name ?? trimmed,
              address: suggestion.full_address ?? suggestion.address,
              context: contextNames,
              distanceMeters: suggestion.distance ?? undefined,
              location: location ?? undefined,
            };
          }) ?? [];

        setPlaceResults(mapped);
        setPlacesError(null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to search locations via Mapbox", err);
        if (requestId === requestIdRef.current) {
          setPlaceResults([]);
          setPlacesError("We couldn’t fetch locations. Please try again.");
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsPlacesLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [placeQuery, view, ensureSessionToken, userLocation]);

  const fetchLocationDetails = useCallback(
    async (mapboxId: string): Promise<LocationSearchResult | null> => {
      try {
        const sessionToken = ensureSessionToken();
        const params = new URLSearchParams({
          session_token: sessionToken,
          access_token: env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
        });
        const response = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error(`Mapbox retrieve error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as SearchBoxRetrieveResponse;
        const feature = data.features?.[0];
        if (!feature?.geometry?.coordinates || feature.geometry.coordinates.length < 2) {
          return null;
        }

        const [longitude, latitude] = feature.geometry.coordinates;
        const contextNames = extractContextNames(feature.properties?.context);

        return {
          id: mapboxId,
          name: feature.properties?.name ?? feature.properties?.full_address ?? feature.properties?.place_formatted ?? feature.name ?? mapboxId,
          placeName: feature.properties?.place_formatted ?? feature.properties?.full_address ?? feature.name ?? mapboxId,
          latitude,
          longitude,
          address: feature.properties?.full_address,
          context: contextNames,
        };
      } catch (error) {
        console.error("Failed to retrieve place details from Mapbox", error);
        return null;
      }
    },
    [ensureSessionToken]
  );

  const filteredRoutes = useMemo(() => {
    if (!routes) return [];
    const q = routeQuery.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) =>
      [r.ShortName, r.LongName, r.Description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(q))
    );
  }, [routes, routeQuery]);

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

  const routesStatusMessage = useMemo(() => {
    if (areRoutesLoading) return "Loading routes…";
    if (!routes?.length) return "No routes available.";
    if (!routeQuery.trim()) return `${routes.length} routes`;
    return `${filteredRoutes.length} routes match`;
  }, [areRoutesLoading, routes, filteredRoutes, routeQuery]);

  const placesStatusMessage = useMemo(() => {
    if (!placeQuery.trim()) return "Search for a building or location.";
    if (placesError) return placesError;
    if (isPlacesLoading) return "Searching…";
    if (!placeResults.length) return "No places found.";
    return `${placeResults.length} places`;
  }, [placeQuery, placesError, isPlacesLoading, placeResults.length]);

  const itineraryStatusMessage = useMemo(() => {
    switch (planStatus) {
      case "loading":
        return hasOrigin ? "Calculating routes…" : "Waiting for your location…";
      case "error":
        return planError ?? "We couldn’t calculate a route.";
      case "success":
        if (!itineraries?.length) {
          return "No itineraries available. Try adjusting your search.";
        }
        return null;
      default:
        return "Select a destination to see suggested routes.";
    }
  }, [planStatus, planError, itineraries, hasOrigin]);

  const renderLegDescription = useCallback(
    (leg: PlanItinerary["legs"][number], index: number, legs: PlanItinerary["legs"]) => {
      if (leg.type === "walk") {
        if (index === 0 && legs.length > 1) {
          return `Walk ${formatDistance(leg.distanceMeters)} (${formatMinutes(leg.durationMinutes)}) to ${
            leg.endStopName ?? "the stop"
          }`;
        }

        if (index === legs.length - 1 && legs.length > 1) {
          return `Walk ${formatDistance(leg.distanceMeters)} (${formatMinutes(leg.durationMinutes)}) to your destination`;
        }

        return `Walk ${formatDistance(leg.distanceMeters)} (${formatMinutes(leg.durationMinutes)})`;
      }

      const hopCount = Math.max((leg.stopCount ?? 1) - 1, 0);
      const stopLabel = hopCount <= 0 ? "non-stop" : hopCount === 1 ? "1 stop" : `${hopCount} stops`;
      const routeLabel = leg.routeNumber ?? leg.routeName ?? "bus";
      const destinationLabel = leg.endStopName ?? "your stop";

      return `Take ${routeLabel} to ${destinationLabel} (${stopLabel}, ${formatMinutes(leg.durationMinutes)})`;
    },
    []
  );

  const handleSelectPlace = useCallback(
    async (place: PlaceResult) => {
      if (!onSelectLocation) return;

      if (place.location) {
        onSelectLocation(place.location);
        setView("itineraries");
        resetSessionToken();
        return;
      }

      const location = await fetchLocationDetails(place.mapboxId);
      if (location) {
        onSelectLocation(location);
        setPlaceResults((prev) =>
          prev.map((item) => (item.mapboxId === place.mapboxId ? { ...item, location } : item))
        );
        setView("itineraries");
      }
      resetSessionToken();
    },
    [fetchLocationDetails, onSelectLocation, resetSessionToken, setView]
  );

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-50">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-md bg-white/90 px-3 text-sm shadow-md backdrop-blur hover:bg-white"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
            Explore
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content className="pointer-events-auto fixed inset-y-4 left-4 z-50 flex w-[340px] flex-col overflow-hidden rounded-lg border bg-background p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-base font-semibold">Explore Lokal</Dialog.Title>
              <Dialog.Close asChild>
                <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {view === "itineraries" ? (
              <div className="mb-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("places")}
                  className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:border-border hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to places
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{selectedLocation?.name ?? "Suggested routes"}</div>
                  {selectedLocation?.placeName && (
                    <div className="truncate text-xs text-muted-foreground">{selectedLocation.placeName}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setView("routes")}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    view === "routes" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bus className="h-4 w-4" />
                  Routes
                </button>
                <button
                  type="button"
                  onClick={() => setView("places")}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    view === "places" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  Places
                </button>
              </div>
            )}

            {view === "routes" ? (
              <>
                <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2">
                  <Search className="h-4 w-4 opacity-60" />
                  <input
                    value={routeQuery}
                    onChange={(event) => setRouteQuery(event.target.value)}
                    placeholder="Search routes…"
                    className="h-9 w-full bg-transparent text-sm outline-none"
                  />
                </div>

                <div className="mb-2 text-xs opacity-60">{routesStatusMessage}</div>

                <div className="flex-1 min-h-0">
                  <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
                    <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
                      <ul className="space-y-2 p-2 pr-3">
                        {filteredRoutes.map((route) => {
                          const color = `#${(route.Color ?? "").trim()}`;
                          const subtitle = route.Description && route.Description.length > 0 ? route.Description : "";
                          const isActive = route.RouteId === selectedRouteId;

                          return (
                            <li key={route.RouteId}>
                              <button
                                className={`relative w-full max-w-full overflow-hidden rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition hover:shadow-md ${
                                  isActive ? "border-blue-500 ring-2 ring-blue-500/40 bg-blue-50" : ""
                                }`}
                                aria-pressed={isActive}
                                onClick={() => onSelectRoute?.(route)}
                                title={route.LongName}
                              >
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm text-muted-foreground">
                                      {subtitle || route.LongName}
                                    </div>
                                    <div className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
                                      {route.LongName || route.ShortName}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">On Time</div>
                                  </div>
                                  <div className="text-right">
                                    <span
                                      className="block text-5xl font-extrabold leading-none tracking-tighter tabular-nums"
                                      style={{ color }}
                                    >
                                      {route.ShortName.includes("Route ")
                                        ? route.ShortName.split("Route ")[1]
                                        : route.ShortName}
                                    </span>
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
            ) : view === "places" ? (
              <>
                <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2">
                  <Search className="h-4 w-4 opacity-60" />
                  <input
                    value={placeQuery}
                    onChange={(event) => setPlaceQuery(event.target.value)}
                    placeholder="Search locations or buildings…"
                    className="h-9 w-full bg-transparent text-sm outline-none"
                  />
                </div>

                <div className="mb-2 text-xs opacity-60">{placesStatusMessage}</div>

                <div className="flex-1 min-h-0">
                  <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
                    <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
                      <ul className="space-y-2 p-2 pr-3">
                        {placesWithDistance.map((place) => {
                          const activeLocationId = selectedLocation?.id ?? selectedLocationId;
                          const identifiedLocation = place.location;
                          const summaryContext = place.context.join(" • ");
                          const subtitle = place.address || summaryContext || place.placeName;
                          const computedDistanceMeters =
                            place.distanceMeters !== undefined
                              ? place.distanceMeters
                              : userLocation && identifiedLocation
                                ? distanceBetweenMeters(userLocation, {
                                    latitude: identifiedLocation.latitude,
                                    longitude: identifiedLocation.longitude,
                                  })
                                : undefined;
                          const distanceLabel =
                            computedDistanceMeters !== undefined
                              ? `${formatDistance(computedDistanceMeters)} away`
                              : "Distance unavailable";
                          const isActive =
                            (!!activeLocationId &&
                              (identifiedLocation?.id === activeLocationId || place.mapboxId === activeLocationId));

                          return (
                            <li key={place.mapboxId}>
                              <button
                                className={`relative w-full max-w-full overflow-hidden rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition hover:shadow-md ${
                                  isActive ? "border-blue-500 ring-2 ring-blue-500/40 bg-blue-50" : ""
                                }`}
                                aria-pressed={isActive}
                                onClick={() => handleSelectPlace(place)}
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
            ) : (
              <>
                {!selectedLocation ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-4 text-xs text-muted-foreground">
                    Choose a destination to view suggested routes.
                  </div>
                ) : (
                  <div className="flex-1 min-h-0">
                    <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
                      <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
                        <div className="space-y-2 p-2 pr-3">
                          {planStatus !== "success" ? (
                            <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                              {itineraryStatusMessage}
                            </div>
                          ) : !itineraries?.length ? (
                            <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                              {itineraryStatusMessage ?? "No itineraries found."}
                            </div>
                          ) : (
                            itineraries.map((itinerary, index) => {
                              const isActive = index === selectedItineraryIndex;
                              return (
                                <button
                                  key={`${itinerary.routeId ?? "walk"}-${index}`}
                                  type="button"
                                  onClick={() => onSelectItinerary?.(index, itinerary)}
                                  className={`w-full rounded-xl border p-3 text-left transition ${
                                    isActive
                                      ? "border-blue-500 bg-blue-50/70 shadow-sm"
                                      : "border-transparent bg-white/70 hover:border-blue-300 hover:bg-blue-50/50"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-lg font-semibold text-foreground">
                                      {formatMinutes(itinerary.totalDurationMinutes)}
                                    </div>
                                    <div className="text-xs font-medium text-muted-foreground">
                                      {formatDistance(itinerary.totalDistanceMeters)}
                                    </div>
                                  </div>

                                  {itinerary.routeNumber && (
                                    <div className="mt-1 text-xs font-medium uppercase tracking-wide text-blue-600">
                                      Route {itinerary.routeNumber}
                                    </div>
                                  )}

                                  <div className="mt-2 space-y-1.5">
                                    {itinerary.legs.map((leg, legIndex, legs) => (
                                      <div key={legIndex} className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <span className="mt-0.5">
                                          {leg.type === "walk" ? (
                                            <Footprints className="h-3.5 w-3.5 opacity-60" />
                                          ) : (
                                            <BusFront className="h-3.5 w-3.5 opacity-60" />
                                          )}
                                        </span>
                                        <span>{renderLegDescription(leg, legIndex, legs)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea.Viewport>
                      <ScrollArea.Scrollbar orientation="vertical">
                        <ScrollArea.Thumb className="rounded-full bg-border/60" />
                      </ScrollArea.Scrollbar>
                      <ScrollArea.Corner />
                    </ScrollArea.Root>
                  </div>
                )}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

interface SearchBoxSuggestResponse {
  suggestions?: Array<{
    name?: string;
    mapbox_id: string;
    feature_type?: string;
    address?: string;
    full_address?: string;
    place_formatted?: string;
    context?: SuggestionContextInput;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    distance?: number;
  }>;
}

interface SearchBoxRetrieveResponse {
  features?: Array<{
    id?: string;
    name?: string;
    geometry?: {
      type?: string;
      coordinates?: [number, number];
    };
    properties?: {
      name?: string;
      full_address?: string;
      place_formatted?: string;
      context?: SuggestionContextInput;
    };
  }>;
}

interface PlaceResult {
  mapboxId: string;
  name: string;
  placeName: string;
  address?: string;
  context: string[];
  distanceMeters?: number;
  location?: LocationSearchResult;
}
