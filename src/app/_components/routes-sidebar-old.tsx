"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { ArrowLeft, Bookmark, Bus, BusFront, Footprints, MapPin, Menu, Search, X, History } from "lucide-react";

import { AuthDialog } from "@/app/_components/auth-dialog";
import { ProfileDialog } from "@/app/_components/profile-dialog";
import { SavedItemsDialog } from "@/app/_components/saved-items-dialog";
import { SaveJourneyDialog } from "@/app/_components/save-journey-dialog";
import { env } from "@/env";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/react";
import { useSession } from "@/trpc/session";
import { useSavedItems } from "@/trpc/saved-items";
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

type SidebarView = "routes" | "places" | "route-options" | "step-by-step" | "saved";

type PlanStatus = "idle" | "loading" | "success" | "error";

type AppMode = "explore" | "plan";

interface RoutesSidebarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  selectedRouteId?: number;
  onSelectRoute?: (route: RouteSummary) => void;
  selectedLocationId?: string;
  selectedLocation?: LocationSearchResult | null;
  journeyStops?: LocationSearchResult[];
  onAddStop?: (location: LocationSearchResult) => void;
  onRemoveStop?: (id: string) => void;
  onClearJourney?: () => void;
  onPlanJourney?: () => void;
  userLocation?: { latitude: number; longitude: number } | null;
  manualOrigin?: LocationSearchResult | null;
  onSetManualOrigin?: (location: LocationSearchResult | null) => void;
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
  mode,
  onModeChange,
  selectedRouteId,
  onSelectRoute,
  selectedLocationId,
  selectedLocation,
  journeyStops = [],
  onAddStop,
  onRemoveStop: _onRemoveStop,
  onClearJourney: _onClearJourney,
  onPlanJourney,
  userLocation,
  manualOrigin,
  onSetManualOrigin,
  hasOrigin = false,
  itineraries,
  planStatus = "idle",
  planError = null,
  selectedItineraryIndex = 0,
  onSelectItinerary,
}: RoutesSidebarProps) {
  const router = useRouter();
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
  const [savedItemsOpen, setSavedItemsOpen] = useState(false);
  const [saveJourneyOpen, setSaveJourneyOpen] = useState(false);
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const [authDefaultMode, setAuthDefaultMode] = useState<"signin" | "signup">("signin");
  const savedItems = useSavedItems();
  const activeDestination = journeyStops.length
    ? journeyStops[journeyStops.length - 1]
    : selectedLocation ?? null;
  const journeyStopIds = useMemo(() => new Set(journeyStops.map((stop) => stop.id)), [journeyStops]);
  const finalStopId = activeDestination?.id ?? selectedLocationId ?? null;

  const { data: routes, isLoading: areRoutesLoading } = api.bus.getRoutes.useQuery();
  const { data: allVehicles } = api.bus.getAllVehicles.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  const vehiclesByRoute = useMemo(() => {
    if (!allVehicles) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const vehicle of allVehicles) {
      const count = map.get(vehicle.RouteId) ?? 0;
      map.set(vehicle.RouteId, count + 1);
    }
    return map;
  }, [allVehicles]);

  useEffect(() => {
    const previousId = previousLocationIdRef.current;
    const currentId = activeDestination?.id ?? null;

    if (currentId && currentId !== previousId) {
      setView("route-options");
    } else if (!currentId && previousId && (view === "route-options" || view === "step-by-step")) {
      setView("places");
    }

    previousLocationIdRef.current = currentId;
  }, [activeDestination, view]);

  // Switch to route-options view when journey is loaded
  useEffect(() => {
    if (itineraries && itineraries.length > 0 && planStatus === "success") {
      setView("route-options");
    }
  }, [itineraries, planStatus]);

  // Sync view with mode
  useEffect(() => {
    if (mode === "explore") {
      setView("routes");
    } else if (mode === "plan" && view === "routes") {
      setView("places");
    }
  }, [mode, view]);

  useEffect(() => {
    if (session.status === "authenticated" && pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      void action();
    }
  }, [session.status]);

  const requireAuth = useCallback((action: () => void | Promise<void>, defaultMode: "signin" | "signup" = "signin") => {
    if (session.status !== "authenticated") {
      pendingActionRef.current = action;
      setAuthDefaultMode(defaultMode);
      setAuthOpen(true);
      return;
    }
    void action();
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


  const handleAddPlace = useCallback(
    (place: PlaceResult) => {
      if (!onAddStop) return;

      const performSelection = async () => {
        if (place.location) {
          onAddStop(place.location);
          setView("route-options");
          resetSessionToken();
          return;
        }

        const location = await fetchLocationDetails(place.mapboxId);
        if (location) {
          onAddStop(location);
          setPlaceResults((prev) =>
            prev.map((item) => (item.mapboxId === place.mapboxId ? { ...item, location } : item))
          );
          setView("route-options");
        }
        resetSessionToken();
      };

      // No auth required for browsing - allow users to explore
      void performSelection();
    },
    [fetchLocationDetails, onAddStop, resetSessionToken, setView]
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
              <Dialog.Title className="text-base font-semibold">Lokal Transit</Dialog.Title>
              <Dialog.Close asChild>
                <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Mode Toggle */}
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => onModeChange("explore")}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  mode === "explore" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Bus className="h-4 w-4" />
                Explore Bus Lines
              </button>
              <button
                type="button"
                onClick={() => onModeChange("plan")}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  mode === "plan" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapPin className="h-4 w-4" />
                Plan Journey
              </button>
            </div>

            {view === "route-options" ? (
              <div className="mb-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("places")}
                  className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:border-border hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to search
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {activeDestination?.name ?? "Suggested routes"}
                  </div>
                  {activeDestination?.placeName && (
                    <div className="text-xs text-muted-foreground truncate">
                      {activeDestination.placeName}
                    </div>
                  )}
                </div>
              </div>
            ) : view === "step-by-step" ? (
              <div className="mb-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("route-options")}
                  className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:border-border hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to routes
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    Step-by-step
                  </div>
                  {activeDestination?.name && (
                    <div className="text-xs text-muted-foreground truncate">
                      To {activeDestination.name}
                    </div>
                  )}
                </div>
              </div>
            ) : mode === "explore" ? (
              <div className="mb-2 text-xs font-medium text-muted-foreground px-1">
                Browse bus lines and see active buses
              </div>
            ) : (
              <div className="mb-2 text-xs font-medium text-muted-foreground px-1">
                Search for your destination
              </div>
            )}

            {mode === "explore" && view === "routes" ? (
              <>
                <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2">
                  <Search className="h-4 w-4 opacity-60" />
                  <input
                    value={routeQuery}
                    onChange={(event) => setRouteQuery(event.target.value)}
                    placeholder="Search bus lines…"
                    className="h-9 w-full bg-transparent text-sm outline-none"
                  />
                </div>

                <div className="mb-2 flex items-center gap-2 text-xs opacity-60">
                  {areRoutesLoading && (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  )}
                  <span>{routesStatusMessage}</span>
                </div>

                <div className="flex-1 min-h-0">
                  <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
                    <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
                      <ul className="space-y-2 p-2 pr-3">
                        {filteredRoutes.map((route) => {
                          const color = `#${(route.Color ?? "").trim()}`;
                          const subtitle = route.Description && route.Description.length > 0 ? route.Description : "";
                          const isActive = route.RouteId === selectedRouteId;
                          const vehicleCount = vehiclesByRoute.get(route.RouteId) ?? 0;
                          const statusText = vehicleCount > 0
                            ? `${vehicleCount} bus${vehicleCount === 1 ? "" : "es"} active`
                            : "No active buses";

                          const isSaved = savedItems.routes.some((r) => r.routeId === route.RouteId.toString());

                          return (
                            <li key={route.RouteId} className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requireAuth(async () => {
                                    // Optimistic update - disable button immediately
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
                                        await savedItems.saveRoute(route.RouteId.toString(), route.LongName);
                                      }
                                    } finally {
                                      button.disabled = false;
                                    }
                                  });
                                }}
                                aria-label={isSaved ? "Remove saved route" : "Save route"}
                                className={`flex-shrink-0 mt-3 inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isSaved
                                    ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                                    : "border-border/70 text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                <Bookmark className="h-4 w-4" fill={isSaved ? "currentColor" : "none"} />
                              </button>
                              <button
                                className={`flex-1 relative max-w-full overflow-hidden rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
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
                                    <div className="mt-1 text-xs text-muted-foreground">{statusText}</div>
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
            ) : mode === "plan" && view === "places" ? (
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
                  {isPlacesLoading && (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  )}
                  <span>{placesStatusMessage}</span>
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
            ) : view === "route-options" ? (
              <>
                {planStatus !== "success" ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-4">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {planStatus === "loading" && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      )}
                      <span>{itineraryStatusMessage}</span>
                    </div>
                  </div>
                ) : !itineraries?.length ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-4 text-xs text-muted-foreground">
                    {itineraryStatusMessage ?? "No routes found."}
                  </div>
                ) : (
                  <div className="flex-1 min-h-0">
                    <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
                      <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
                        <div className="space-y-2 p-3">
                          {(itineraries ?? []).map((itinerary, index) => {
                              const walkLegs = itinerary.legs.filter((leg) => leg.type === "walk");
                              const busLegs = itinerary.legs.filter((leg) => leg.type === "bus");
                              const totalWalkDistance = walkLegs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
                              const stopCount = busLegs.reduce((sum, leg) => sum + (leg.stopCount ?? 1) - 1, 0);

                              return (
                                <button
                                  key={`${itinerary.routeId ?? "walk"}-${index}`}
                                  onClick={() => {
                                    onSelectItinerary?.(index, itinerary);
                                    setView("step-by-step");
                                  }}
                                  className="w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
                                >
                                  <div className="mb-3 flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-2xl font-bold text-foreground">
                                        {formatMinutes(itinerary.totalDurationMinutes)}
                                      </div>
                                      <div className="mt-1 text-sm text-muted-foreground">
                                        {formatDistance(itinerary.totalDistanceMeters)} • {stopCount} {stopCount === 1 ? "stop" : "stops"}
                                      </div>
                                    </div>
                                    {itinerary.routeNumber && (
                                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600">
                                        <span className="text-lg font-bold text-white">
                                          {itinerary.routeNumber}
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
                )}
              </>
            ) : view === "step-by-step" ? (
              <>
                {itineraries?.[selectedItineraryIndex ?? 0] ? (
                  <div className="flex-1 min-h-0">
                    <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
                      <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
                        <div className="space-y-3 p-3">
                          {(() => {
                            const itinerary = itineraries[selectedItineraryIndex ?? 0]!;
                            const isSaved = savedItems.journeys.some(
                              (j) => JSON.stringify(j.itineraryData) === JSON.stringify(itinerary)
                            );

                            return (
                              <>
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
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        requireAuth(async () => {
                                          // Optimistic update - disable button immediately
                                          const button = e.currentTarget;
                                          button.disabled = true;

                                          try {
                                            if (isSaved) {
                                              const journeyToRemove = savedItems.journeys.find(
                                                (j) => JSON.stringify(j.itineraryData) === JSON.stringify(itinerary)
                                              );
                                              if (journeyToRemove) {
                                                await savedItems.remove(journeyToRemove.id);
                                              }
                                            } else {
                                              setSaveJourneyOpen(true);
                                            }
                                          } finally {
                                            button.disabled = false;
                                          }
                                        });
                                      }}
                                      aria-label={isSaved ? "Remove from saved" : "Save journey"}
                                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                        isSaved
                                          ? "bg-blue-600 border-blue-600 text-white"
                                          : "bg-white border-blue-300 text-blue-600 hover:bg-blue-100"
                                      }`}
                                    >
                                      <Bookmark className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} />
                                    </button>
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
                                    {activeDestination?.name ?? "Destination"}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </ScrollArea.Viewport>
                      <ScrollArea.Scrollbar orientation="vertical">
                        <ScrollArea.Thumb className="rounded-full bg-border/60" />
                      </ScrollArea.Scrollbar>
                      <ScrollArea.Corner />
                    </ScrollArea.Root>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-4 text-xs text-muted-foreground">
                    No route selected
                  </div>
                )}
              </>
            ) : null}
            {session.status === "authenticated" && (
              <div className="mb-3 flex gap-2">
                <button
                  onClick={() => router.push("/saved")}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  My Journeys
                </button>
                <button
                  onClick={() => router.push("/history")}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
              </div>
            )}
            <div className="border-t pt-3">
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
                <div className="space-y-2">
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
                  <button
                    type="button"
                    onClick={() => setSavedItemsOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-blue-600 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    <Bookmark className="h-4 w-4" />
                    My Saved Items ({savedItems.items.length})
                  </button>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode={authDefaultMode} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <SavedItemsDialog open={savedItemsOpen} onOpenChange={setSavedItemsOpen} />
      <SaveJourneyDialog
        open={saveJourneyOpen}
        onOpenChange={setSaveJourneyOpen}
        itinerary={itineraries?.[selectedItineraryIndex ?? 0] ?? null}
        originLat={userLocation?.latitude ?? 0}
        originLng={userLocation?.longitude ?? 0}
        defaultNickname={activeDestination?.name ?? activeDestination?.placeName}
      />
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
