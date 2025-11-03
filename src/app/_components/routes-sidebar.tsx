"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { ArrowLeft, Bookmark, Bus, BusFront, Footprints, MapPin, Menu, Search, X } from "lucide-react";

import { AuthDialog } from "@/app/_components/auth-dialog";
import { ProfileDialog } from "@/app/_components/profile-dialog";
import { env } from "@/env";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/react";
import { useSession } from "@/trpc/session";
import { useSavedRoutes } from "@/trpc/saved-routes";
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

type SidebarView = "routes" | "places" | "itineraries" | "saved";

type PlanStatus = "idle" | "loading" | "success" | "error";

interface RoutesSidebarProps {
  selectedRouteId?: number;
  onSelectRoute?: (route: RouteSummary) => void;
  selectedLocationId?: string;
  selectedLocation?: LocationSearchResult | null;
  journeyStops?: LocationSearchResult[];
  onAddStop?: (location: LocationSearchResult) => void;
  onRemoveStop?: (id: string) => void;
  onClearJourney?: () => void;
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

const isContextEntry = (value: unknown): value is ContextEntry =>
  value === null || value === undefined || typeof value === "object";

function extractContextNames(context: unknown): string[] {
  if (!context) return [];

  const entries: ContextEntry[] = [];

  if (Array.isArray(context)) {
    for (const entry of context) {
      if (isContextEntry(entry)) {
        entries.push(entry);
      }
    }
  } else if (typeof context === "object") {
    const values = Object.values(context as Record<string, unknown>);
    for (const value of values) {
      if (!value) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isContextEntry(item)) {
            entries.push(item);
          }
        }
      } else if (isContextEntry(value)) {
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

/**
 * Sidebar that orchestrates route discovery, saved routes, and location searches while
 * coordinating with authentication-aware actions and multiple asynchronous data sources.
 */
export function RoutesSidebar({
  selectedRouteId,
  onSelectRoute,
  selectedLocationId,
  selectedLocation,
  journeyStops = [],
  onAddStop,
  onRemoveStop,
  onClearJourney,
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
  const session = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [authDefaultMode, setAuthDefaultMode] = useState<"signin" | "signup">("signin");
  const saved = useSavedRoutes();
  const activeDestination = journeyStops.length
    ? journeyStops[journeyStops.length - 1]
    : selectedLocation ?? null;
  const journeyStopIds = useMemo(() => new Set(journeyStops.map((stop) => stop.id)), [journeyStops]);
  const finalStopId = activeDestination?.id ?? selectedLocationId ?? null;

  const { data: routes, isLoading: areRoutesLoading } = api.bus.getRoutes.useQuery();

  useEffect(() => {
    const previousId = previousLocationIdRef.current;
    const currentId = activeDestination?.id ?? null;

    if (currentId && currentId !== previousId) {
      setView("itineraries");
    } else if (!currentId && previousId && view === "itineraries") {
      setView("places");
    }

    previousLocationIdRef.current = currentId;
  }, [activeDestination, view]);

  useEffect(() => {
    if (session.status === "authenticated" && pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action();
    }
  }, [session.status]);

  const requireAuth = useCallback((action: () => void, defaultMode: "signin" | "signup" = "signin") => {
    if (session.status !== "authenticated") {
      pendingActionRef.current = action;
      setAuthDefaultMode(defaultMode);
      setAuthOpen(true);
      return;
    }
    action();
  }, [session.status]);

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

    const timeoutId = window.setTimeout(() => {
      setIsPlacesLoading(true);

      const runSearch = async () => {
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

          const response = await fetch(
            `https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`,
            { signal: controller.signal }
          );
          if (!response.ok) {
            throw new Error(`Mapbox Search Box error: ${response.status} ${response.statusText}`);
          }

          const rawData = (await response.json()) as unknown;
          const data = rawData as SearchBoxSuggestResponse;

          if (requestId !== requestIdRef.current) {
            return;
          }

          const mapped =
            data.suggestions?.map<PlaceResult>((suggestion) => {
              const { mapbox_id: mapboxId } = suggestion;
              const rawCoordinates = suggestion.coordinates;
              const hasValidCoordinates =
                rawCoordinates !== undefined &&
                rawCoordinates !== null &&
                typeof rawCoordinates.latitude === "number" &&
                typeof rawCoordinates.longitude === "number";
              const coordinates = hasValidCoordinates
                ? { latitude: rawCoordinates.latitude, longitude: rawCoordinates.longitude }
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
      };

      void runSearch();
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

  const handleAddPlace = useCallback(
    (place: PlaceResult) => {
      if (!onAddStop) return;

      const performSelection = async () => {
        if (place.location) {
          onAddStop(place.location);
          setView("itineraries");
          resetSessionToken();
          return;
        }

        const location = await fetchLocationDetails(place.mapboxId);
        if (location) {
          onAddStop(location);
          setPlaceResults((prev) =>
            prev.map((item) => (item.mapboxId === place.mapboxId ? { ...item, location } : item))
          );
          setView("itineraries");
        }
        resetSessionToken();
      };

      requireAuth(() => {
        void performSelection();
      });
    },
    [fetchLocationDetails, onAddStop, resetSessionToken, setView, requireAuth]
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
          <Dialog.Content className="pointer-events-auto fixed inset-y-4 left-4 z-50 flex min-w-[340px] max-w-[600px] flex-col overflow-hidden rounded-lg border bg-background p-3 shadow-xl">
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
                  <div className="truncate text-sm font-semibold text-foreground">
                    {activeDestination?.name ?? "Suggested routes"}
                  </div>
                  {(activeDestination?.placeName || journeyStops.length > 1) && (
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {journeyStops.length > 1 && <span>{journeyStops.length} stops</span>}
                      {journeyStops.length > 1 && activeDestination?.placeName && <span>&middot;</span>}
                      {activeDestination?.placeName && <span className="truncate">{activeDestination.placeName}</span>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-3 grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-1">
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
                <button
                  type="button"
                  onClick={() => {
                    if (session.status !== "authenticated") {
                      setAuthDefaultMode("signin");
                      setAuthOpen(true);
                      return;
                    }
                    setView("saved");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    view === "saved" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bookmark className="h-4 w-4" />
                  Saved
                </button>
              </div>
            )}

            {view === "routes" ? (
              <>
                <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2">
                  <Search className="h-4 w-4 opacity-60" />
                  <input
                    value={routeQuery}
                    onChange={(event) => requireAuth(() => setRouteQuery(event.target.value))}
                    onFocus={() => { if (session.status !== "authenticated") { setAuthDefaultMode("signin"); setAuthOpen(true); } }}
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
                    onChange={(event) => requireAuth(() => setPlaceQuery(event.target.value))}
                    onFocus={() => { if (session.status !== "authenticated") { setAuthDefaultMode("signin"); setAuthOpen(true); } }}
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
                              ((identifiedLocation && identifiedLocation.id === finalStopId) ||
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
                                className={`relative w-full max-w-full overflow-hidden rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition hover:shadow-md ${
                                  highlightClass
                                }`}
                                aria-pressed={isJourneyStop}
                                onClick={() => handleAddPlace(place)}
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
            ) : view === "saved" ? (
              <>
                <div className="mb-2 text-xs opacity-60">
                  {saved.isFetching ? "Loading..." : `${saved.routes.length} saved route${saved.routes.length === 1 ? "" : "s"}`}
                </div>
                <div className="flex-1 min-h-0">
                  <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
                    <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
                      <ul className="space-y-2 p-2 pr-3">
                        {saved.routes.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                            No saved routes yet. Save a route from the itineraries view!
                          </div>
                        ) : (
                          saved.routes.map((savedRoute) => (
                            <li key={savedRoute.id} className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void saved.remove(savedRoute.routeId);
                                }}
                                aria-label="Remove saved route"
                                className="flex-shrink-0 mt-3 inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                              >
                                <Bookmark className="h-4 w-4" fill="currentColor" />
                              </button>
                              <div className="flex-1 rounded-2xl border bg-card px-4 py-4 shadow-sm">
                                <div className="min-w-0">
                                  {savedRoute.nickname && (
                                    <div className="truncate text-sm font-medium text-foreground" title={savedRoute.nickname}>
                                      {savedRoute.nickname.length > 20 
                                        ? savedRoute.nickname.substring(0, 20) + '...' 
                                        : savedRoute.nickname}
                                    </div>
                                  )}
                                  <div className="truncate text-lg font-semibold tracking-tight text-foreground">
                                    {savedRoute.route.name}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Route {savedRoute.route.number}
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))
                        )}
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
                {!journeyStops.length ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-4 text-xs text-muted-foreground">
                    Add at least one stop to build a journey.
                  </div>
                ) : (
                  <div className="flex-1 min-h-0">
                    <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
                      <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
                        <div className="space-y-2 p-2 pr-3">
                          <div className="rounded-xl border border-blue-200 bg-blue-50/30 px-3 py-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                Journey stops
                              </div>
                              {onClearJourney && journeyStops.length > 0 && (
                                <button
                                  type="button"
                                  onClick={onClearJourney}
                                  className="inline-flex h-6 items-center justify-center rounded-full border border-blue-200 px-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition hover:bg-blue-100"
                                >
                                  Clear all
                                </button>
                              )}
                            </div>
                            <ol className="space-y-2">
                              {journeyStops.map((stop, index) => (
                                <li key={stop.id} className="flex items-start gap-2">
                                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-foreground" title={stop.name}>
                                      {stop.name}
                                    </div>
                                    {stop.placeName && (
                                      <div className="truncate text-xs text-muted-foreground">{stop.placeName}</div>
                                    )}
                                  </div>
                                  {onRemoveStop && (
                                    <button
                                      type="button"
                                      onClick={() => onRemoveStop(stop.id)}
                                      className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-red-200 hover:text-red-600"
                                      aria-label={`Remove stop ${stop.name}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </div>
                          {planStatus !== "success" ? (
                            <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                              {itineraryStatusMessage}
                            </div>
                          ) : !itineraries?.length ? (
                            <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                              {itineraryStatusMessage ?? "No itineraries found."}
                            </div>
                          ) : (
                            (itineraries ?? []).map((itinerary, index) => {
                              const isActive = index === selectedItineraryIndex;
                              return (
                                <div key={`${itinerary.routeId ?? "walk"}-${index}`} className="flex items-start gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      const rid = itinerary.routeId;
                                      
                                      console.log('Bookmark clicked!', { rid, itinerary, hasRouteId: !!rid });

                                      if (!rid) {
                                        console.log('No route ID, skipping save');
                                        return;
                                      }

                                      requireAuth(() => {
                                        console.log('Auth passed, saving/removing route', rid);
                                        if (saved.isSaved(rid)) {
                                          console.log('Removing route', rid);
                                          void saved.remove(rid);
                                        } else {
                                          console.log('Saving route', rid);
                                          // Use the destination name as the nickname (save full name)
                                          const nickname =
                                            activeDestination?.name || activeDestination?.placeName || undefined;
                                          void saved.save(rid, nickname);
                                          // After saving, select the route for display
                                          if (onSelectRoute) {
                                            const numericRouteId = Number(String(rid).replace(/^\D+/u, ""));
                                            const matchingRoute = routes?.find((route) => route.RouteId === numericRouteId);
                                            if (matchingRoute) {
                                              onSelectRoute(matchingRoute);
                                            }
                                          }
                                        }
                                      });
                                    }}
                                    aria-label={itinerary.routeId && saved.isSaved(itinerary.routeId) ? "Unsave route" : "Save route"}
                                    className={`flex-shrink-0 mt-3 inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${itinerary.routeId && saved.isSaved(itinerary.routeId) ? "bg-blue-50 border-blue-300 text-blue-700" : "border-border/70 text-muted-foreground hover:bg-muted"}`}
                                  >
                                    <Bookmark className="h-4 w-4" fill={itinerary.routeId && saved.isSaved(itinerary.routeId) ? "currentColor" : "none"} />
                                  </button>
                                  <div
                                    onClick={() => onSelectItinerary?.(index, itinerary)}
                                    className={`flex-1 rounded-xl border p-3 cursor-pointer transition ${
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
                                  </div>
                                </div>
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
            <div className="mt-3 border-t pt-3">
              {session.status !== "authenticated" ? (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => { setAuthDefaultMode("signin"); setAuthOpen(true); }}
                    className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthDefaultMode("signup"); setAuthOpen(true); }}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-foreground px-3 text-xs font-medium text-background"
                  >
                    Sign up
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="truncate">
                    Signed in as <span className="font-medium">{session.user?.name ?? session.user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileOpen(true)}
                      className="inline-flex h-8 items-center justify-center rounded-md border px-2"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => session.signOut()}
                      className="inline-flex h-8 items-center justify-center rounded-md px-2 text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode={authDefaultMode} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
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
