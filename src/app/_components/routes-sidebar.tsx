"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Bookmark, Bus, MapPin, Menu, X } from "lucide-react";

import { AuthDialog } from "@/app/_components/auth-dialog";
import { ProfileDialog } from "@/app/_components/profile-dialog";
import { RoutesList } from "@/app/_components/routes-list";
import { PlaceSearch } from "@/app/_components/place-search";
import { ItineraryOptions } from "@/app/_components/itinerary-options";
import { DirectionsSteps } from "@/app/_components/directions-steps";
import { RouteDetailView } from "@/app/_components/route-detail-view";
import { SavedItemsView } from "@/app/_components/saved-items-view";
import { extractContextNames } from "@/app/_components/utils/mapbox-helpers";
import { env } from "@/env";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/react";
import { useSession } from "@/trpc/session";
import { useSavedItems } from "@/trpc/saved-items";
import type { PlanItinerary } from "@/server/routing/service";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { CACHE_TTL } from "@/lib/cache-keys";

const RESULT_LIMIT = 10;
const DEBOUNCE_MS = 300;

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

type SidebarView = "routes" | "places" | "route-options" | "step-by-step" | "route-detail" | "saved-items";
type PlanStatus = "idle" | "loading" | "success" | "error";
type AppMode = "explore" | "plan" | "saved";

interface RoutesSidebarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  selectedRouteId?: number;
  onSelectRoute?: (route: RouteSummary | undefined) => void;
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
  viewingSavedJourney?: boolean;
  onExitSavedJourneyView?: () => void;
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

type SearchBoxSuggestResponse = {
  suggestions?: Array<{
    name?: string;
    mapbox_id: string;
    coordinates?: { latitude: number; longitude: number };
    address?: string;
    full_address?: string;
    place_formatted?: string;
    context?: unknown;
    distance?: number;
  }>;
};

type SearchBoxRetrieveResponse = {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: {
      name?: string;
      full_address?: string;
      place_formatted?: string;
      context?: unknown;
    };
    name?: string;
  }>;
};

export function RoutesSidebar({
  mode,
  onModeChange,
  selectedRouteId,
  onSelectRoute,
  selectedLocationId,
  selectedLocation,
  journeyStops = [],
  onAddStop,
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
  viewingSavedJourney = false,
  onExitSavedJourneyView,
}: RoutesSidebarProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<SidebarView>("routes");
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
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const [authDefaultMode, setAuthDefaultMode] = useState<"signin" | "signup">("signin");
  const savedItems = useSavedItems();
  const [savedItemsFilter, setSavedItemsFilter] = useState<"all" | "journeys" | "routes">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktop) {
      setOpen(false);
    }
  }, [isDesktop]);

  const activeDestination = journeyStops.length
    ? journeyStops[journeyStops.length - 1]
    : selectedLocation ?? null;
  const journeyStopIds = useMemo(() => new Set(journeyStops.map((stop) => stop.id)), [journeyStops]);
  const finalStopId = activeDestination?.id ?? selectedLocationId ?? null;

  const { data: routes, isLoading: areRoutesLoading } = api.bus.getRoutes.useQuery();
  const { data: allVehicles } = api.bus.getAllVehicles.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const prefetchRouteDetails = api.bus.prefetchRouteDetails.useMutation();

  const vehiclesByRoute = useMemo(() => {
    if (!allVehicles) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const vehicle of allVehicles) {
      const count = map.get(vehicle.RouteId) ?? 0;
      map.set(vehicle.RouteId, count + 1);
    }
    return map;
  }, [allVehicles]);

  // Track if we've already prefetched to avoid repeated prefetching
  const hasPrefetchedRef = useRef(false);

  // Prefetch route details when routes are loaded
  useEffect(() => {
    if (!routes || routes.length === 0 || hasPrefetchedRef.current) return;

    // Prefetch route details for all routes in batches to avoid overwhelming the system
    // Process in batches of 10 routes at a time
    const batchSize = 10;
    const allRouteIds = routes.map((r) => r.RouteId);
    
    // Process batches with a small delay between them
    const prefetchBatches = async () => {
      for (let i = 0; i < allRouteIds.length; i += batchSize) {
        const batch = allRouteIds.slice(i, i + batchSize);
        prefetchRouteDetails.mutate(
          { routeIds: batch },
          {
            onError: (error: unknown) => {
              // Silently fail - prefetching is best effort
              console.debug(`Failed to prefetch route details batch ${i / batchSize + 1}:`, error);
            },
          }
        );
        // Small delay between batches to avoid overwhelming the server
        if (i + batchSize < allRouteIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    };
    
    // Start prefetching in background
    void prefetchBatches();
    
    hasPrefetchedRef.current = true;
  }, [routes, prefetchRouteDetails]);

  // Fetch route details when a route is selected in explore mode
  const { data: routeDetails } = api.bus.getRouteDetails.useQuery(
    { routeId: selectedRouteId ?? 0 },
    {
      enabled: selectedRouteId !== undefined && selectedRouteId !== null && mode === "explore",
      refetchInterval: 30000,
    }
  );

  // Get the selected route object
  const selectedRoute = useMemo(() => {
    if (!selectedRouteId || !routes) return null;
    return routes.find((r) => r.RouteId === selectedRouteId) ?? null;
  }, [selectedRouteId, routes]);

  // View management
  useEffect(() => {
    // Don't manage view based on activeDestination when viewing a saved journey
    if (viewingSavedJourney) return;

    const previousId = previousLocationIdRef.current;
    const currentId = activeDestination?.id ?? null;

    if (currentId && currentId !== previousId) {
      setView("route-options");
    } else if (!currentId && previousId && (view === "route-options" || view === "step-by-step")) {
      setView("places");
    }

    previousLocationIdRef.current = currentId;
  }, [activeDestination, view, viewingSavedJourney]);

  useEffect(() => {
    if (itineraries && itineraries.length > 0 && planStatus === "success") {
      // If viewing a saved journey, skip route-options and go directly to step-by-step
      if (viewingSavedJourney) {
        setView("step-by-step");
      } else {
        setView("route-options");
      }
    }
  }, [itineraries, planStatus, viewingSavedJourney]);

  useEffect(() => {
    if (mode === "explore") {
      if (selectedRouteId && view !== "route-detail") {
        setView("route-detail");
      } else if (!selectedRouteId && view === "route-detail") {
        setView("routes");
      } else if (!selectedRouteId && view !== "route-detail") {
        setView("routes");
      }
    } else if (mode === "plan") {
      // When viewing a saved journey with itineraries loaded, don't switch away from journey views
      if (viewingSavedJourney && itineraries && itineraries.length > 0) {
        // Allow the other useEffect (lines 226-235) to handle the view switch to step-by-step
        if (view === "step-by-step" || view === "route-options") {
          // Keep the current view - don't override
          return;
        }
        // Don't force to "places" when we have itineraries for a saved journey
        return;
      }
      // Otherwise, switch incompatible views to places
      if (view === "routes" || view === "route-detail" || view === "saved-items") {
        setView("places");
      }
    } else if (mode === "saved" && view !== "saved-items") {
      setView("saved-items");
    }
  }, [mode, view, selectedRouteId, viewingSavedJourney, itineraries]);

  useEffect(() => {
    if (session.status === "authenticated" && pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      void action();
    }
  }, [session.status]);

  const requireAuth = useCallback(
    (action: () => void | Promise<void>, defaultMode: "signin" | "signup" = "signin") => {
      if (session.status !== "authenticated") {
        pendingActionRef.current = action;
        setAuthDefaultMode(defaultMode);
        setAuthOpen(true);
        return;
      }
      void action();
    },
    [session.status]
  );

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

  // Place search
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
            params.set("proximity", `${userLocation.longitude},${userLocation.latitude}`);
          }

          const response = await fetch(
            `https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`,
            { signal: controller.signal }
          );
          if (!response.ok) {
            throw new Error(`Mapbox Search Box error: ${response.status} ${response.statusText}`);
          }

          const data = (await response.json()) as SearchBoxSuggestResponse;

          if (requestId !== requestIdRef.current) return;

          const mapped =
            data.suggestions?.map<PlaceResult>((suggestion) => {
              const { mapbox_id: mapboxId } = suggestion;
              const rawCoordinates = suggestion.coordinates;
              const hasValidCoordinates =
                rawCoordinates &&
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
          if (controller.signal.aborted) return;
          console.error("Failed to search locations via Mapbox", err);
          if (requestId === requestIdRef.current) {
            setPlaceResults([]);
            setPlacesError("We couldn't fetch locations. Please try again.");
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

      void performSelection();
    },
    [fetchLocationDetails, onAddStop, resetSessionToken]
  );

  const handleSelectItineraryAndView = useCallback(
    (index: number, itinerary: PlanItinerary) => {
      onSelectItinerary?.(index, itinerary);
      setView("step-by-step");
    },
    [onSelectItinerary]
  );

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4",
        "sm:absolute sm:inset-auto sm:left-4 sm:top-4 sm:bottom-auto sm:right-auto sm:px-0 sm:justify-start"
      )}
    >
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            className="pointer-events-auto inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg transition hover:bg-foreground/90 focus:outline-2 focus:outline-offset-2 focus:outline-ring sm:h-11 sm:w-auto sm:max-w-none sm:rounded-md sm:bg-white/90 sm:px-3 sm:py-0 sm:text-sm sm:font-medium sm:text-foreground sm:shadow-md sm:hover:bg-white"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
            <span className="sm:hidden">Open transit</span>
            <span className="hidden sm:inline">Explore</span>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-background/60 backdrop-blur-sm sm:hidden" />
          <Dialog.Content
            className={cn(
              "pointer-events-auto fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border bg-background p-4 shadow-xl focus:outline-none",
              "sm:inset-auto sm:bottom-auto sm:left-4 sm:top-4 sm:max-h-[calc(100vh-2rem)] sm:w-auto sm:min-w-[340px] sm:max-w-[420px] sm:rounded-xl sm:border sm:p-3 md:max-w-[600px]"
            )}
          >
            {!isDesktop && <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" aria-hidden />}
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-base font-semibold">Lokal Transit</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition hover:bg-muted focus:outline-2 focus:outline-offset-2 focus:outline-ring sm:h-11 sm:w-11 sm:rounded-md sm:bg-transparent sm:text-foreground"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* Mode Toggle */}
              <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-1" role="tablist" aria-label="Application mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "explore"}
                  aria-controls="mode-panel"
                  onClick={() => onModeChange("explore")}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-xs font-medium transition focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
                    mode === "explore" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bus className="h-4 w-4" />
                  Explore
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "plan"}
                  aria-controls="mode-panel"
                  onClick={() => onModeChange("plan")}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-xs font-medium transition focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
                    mode === "plan" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  Plan
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "saved"}
                  aria-controls="mode-panel"
                  onClick={() => onModeChange("saved")}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-xs font-medium transition focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
                    mode === "saved" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bookmark className="h-4 w-4" />
                  Saved
                </button>
              </div>

              {/* View Headers */}
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
                      <div className="truncate text-xs text-muted-foreground">{activeDestination.placeName}</div>
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
                    <div className="truncate text-sm font-semibold text-foreground">Step-by-step</div>
                    {activeDestination?.name && (
                      <div className="truncate text-xs text-muted-foreground">To {activeDestination.name}</div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Content Views */}
              <div id="mode-panel" role="tabpanel" className="-mr-2 flex-1 overflow-y-auto pr-2">
            {mode === "explore" && view === "route-detail" && selectedRoute ? (
              <RouteDetailView
                route={selectedRoute}
                routeDetails={routeDetails}
                onBack={() => {
                  onSelectRoute?.(undefined);
                }}
                requireAuth={requireAuth}
              />
            ) : mode === "explore" && view === "routes" ? (
              <RoutesList
                routes={routes}
                isLoading={areRoutesLoading}
                selectedRouteId={selectedRouteId}
                vehiclesByRoute={vehiclesByRoute}
                hasVehiclesLoaded={!!allVehicles}
                onSelectRoute={onSelectRoute}
                requireAuth={requireAuth}
              />
            ) : mode === "plan" && view === "places" ? (
              <PlaceSearch
                placeQuery={placeQuery}
                onPlaceQueryChange={setPlaceQuery}
                placeResults={placeResults}
                isLoading={isPlacesLoading}
                error={placesError}
                userLocation={userLocation}
                journeyStops={journeyStops}
                journeyStopIds={journeyStopIds}
                finalStopId={finalStopId}
                hasOrigin={hasOrigin}
                manualOrigin={manualOrigin}
                planStatus={planStatus}
                onAddPlace={handleAddPlace}
                onPlanJourney={onPlanJourney}
                onSetManualOrigin={onSetManualOrigin}
              />
            ) : view === "route-options" ? (
              <ItineraryOptions
                itineraries={itineraries}
                planStatus={planStatus}
                planError={planError}
                hasOrigin={hasOrigin}
                onSelectItinerary={handleSelectItineraryAndView}
              />
            ) : view === "step-by-step" ? (
              <DirectionsSteps
                itinerary={itineraries?.[selectedItineraryIndex] ?? null}
                activeDestination={activeDestination}
                requireAuth={requireAuth}
                onSaveJourney={async (itinerary, nickname) => {
                  if (!userLocation) {
                    throw new Error("User location required to save journey");
                  }
                  await savedItems.saveJourney(itinerary, userLocation.latitude, userLocation.longitude, nickname);
                }}
                viewingSavedJourney={viewingSavedJourney}
                onBackToSavedItems={() => {
                  if (onExitSavedJourneyView) {
                    onExitSavedJourneyView();
                  }
                  onModeChange("saved");
                  setView("saved-items");
                }}
              />
            ) : mode === "saved" && view === "saved-items" ? (
              <SavedItemsView
                items={savedItems}
                filter={savedItemsFilter}
                onFilterChange={setSavedItemsFilter}
                deleteConfirm={deleteConfirm}
                onDeleteConfirm={setDeleteConfirm}
                onViewOnMap={(itemId: string) => {
                  router.push(`/?itemId=${itemId}`);
                }}
                onDelete={async (itemId: string) => {
                  await savedItems.remove(itemId);
                  setDeleteConfirm(null);
                }}
              />
            ) : null}
            </div>

              {/* Footer */}
              <div className="mt-3 shrink-0 border-t pt-3">
              {session.status !== "authenticated" ? (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => { setAuthDefaultMode("signin"); setAuthOpen(true); }}
                    className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthDefaultMode("signup"); setAuthOpen(true); }}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-foreground px-3 text-xs font-medium text-background focus:outline-2 focus:outline-offset-2 focus:outline-ring"
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
                      className="inline-flex h-8 items-center justify-center rounded-md border px-2 focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => session.signOut()}
                      className="inline-flex h-8 items-center justify-center rounded-md px-2 text-red-600 hover:bg-red-50 focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode={authDefaultMode} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
