"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapboxMap } from "@/app/_components/map";
import { RoutesSidebar, type LocationSearchResult } from "@/app/_components/routes-sidebar";
import { OnboardingOverlay } from "@/app/_components/onboarding-overlay";
import type { PlanItinerary } from "@/server/routing/service";
import type { RouterOutputs } from "@/trpc/react";
import { useSession } from "@/trpc/session";

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];
type Coordinates = { latitude: number; longitude: number };
type PlanStatus = "idle" | "loading" | "success" | "error";
type AppMode = "explore" | "plan" | "saved";

function extractPlanItineraries(value: unknown): PlanItinerary[] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const itineraries = (value as { itineraries?: unknown }).itineraries;
  if (!Array.isArray(itineraries)) {
    return null;
  }

  return itineraries as PlanItinerary[];
}

export default function Home() {
  const searchParams = useSearchParams();
  const session = useSession();
  const [mode, setMode] = useState<AppMode>("explore");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [manualOrigin, setManualOrigin] = useState<LocationSearchResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteSummary | null>(null);
  const [journeyStops, setJourneyStops] = useState<LocationSearchResult[]>([]);
  const [planItineraries, setPlanItineraries] = useState<PlanItinerary[] | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus>("idle");
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState(0);
  const [viewingSavedJourney, setViewingSavedJourney] = useState(false);

  // Effective origin is either user's GPS location or manually set origin
  const effectiveOrigin = useMemo(
    () => userLocation ?? (manualOrigin ? { latitude: manualOrigin.latitude, longitude: manualOrigin.longitude } : null),
    [userLocation, manualOrigin]
  );

  const activeDestination = journeyStops.length ? journeyStops[journeyStops.length - 1] : null;

  const handleAddStop = useCallback((location: LocationSearchResult) => {
    setMode("plan"); // Switch to plan mode when adding destinations
    setSelectedRoute(null);
    setJourneyStops((previous) => {
      const withoutDuplicate = previous.filter((stop) => stop.id !== location.id);
      return [...withoutDuplicate, location];
    });
    // Don't auto-plan - wait for user to click "Plan Journey" button
    setPlanItineraries(null);
    setPlanStatus("idle");
    setPlanError(null);
    setSelectedItineraryIndex(0);
    setViewingSavedJourney(false); // Clear saved journey flag when starting new journey
  }, []);

  const handleRemoveStop = useCallback((id: string) => {
    setJourneyStops((previous) => {
      const next = previous.filter((stop) => stop.id !== id);
      if (next.length === previous.length) {
        return previous;
      }

      if (!next.length) {
        setPlanStatus("idle");
        setPlanItineraries(null);
        setPlanError(null);
        setSelectedItineraryIndex(0);
      } else {
        setPlanItineraries(null);
        setPlanStatus("loading");
        setPlanError(null);
        setSelectedItineraryIndex(0);
      }

      return next;
    });
  }, []);

  const handleClearJourney = useCallback(() => {
    setJourneyStops([]);
    setPlanItineraries(null);
    setPlanStatus("idle");
    setPlanError(null);
    setSelectedItineraryIndex(0);
    setViewingSavedJourney(false); // Clear saved journey flag
  }, []);

  const handlePlanJourney = useCallback(() => {
    if (journeyStops.length > 0) {
      setPlanItineraries(null);
      setPlanStatus("loading");
      setPlanError(null);
      setSelectedItineraryIndex(0);
    }
  }, [journeyStops]);

  const handleSelectRoute = useCallback((route: RouteSummary | undefined) => {
    if (route) {
      setMode("explore"); // Switch to explore mode when viewing routes
    }
    setSelectedRoute(route ?? null);
    // Don't clear journey data - allow viewing routes while planning
  }, []);

  const handleSelectItinerary = useCallback(
    (index: number, _itinerary: PlanItinerary) => {
      setSelectedItineraryIndex(index);
      // Clear route selection when selecting an itinerary to show the itinerary visualization
      setSelectedRoute(null);
    },
    []
  );

  // Handle itemId from URL parameter (for saved journeys/routes)
  useEffect(() => {
    const itemIdParam = searchParams.get("itemId");
    if (!itemIdParam) {
      return;
    }

    // Wait for session to be loaded
    if (session.status === "loading") {
      return;
    }

    // Check if user is authenticated
    if (session.status !== "authenticated" || !session.user?.id) {
      console.error("Not authenticated - cannot load saved item");
      return;
    }

    const userId = session.user.id;

    // Fetch the saved item and display it
    const loadItem = async () => {
      try {
        const response = await fetch(
          `/api/user/${encodeURIComponent(userId)}/saved-items/${encodeURIComponent(itemIdParam)}`,
          { credentials: "include" }
        );
        if (!response.ok) {
          console.error("Failed to fetch saved item");
          return;
        }

        const data = (await response.json()) as {
          item: {
            type: "JOURNEY" | "ROUTE";
            routeId?: string | null;
            itineraryData?: PlanItinerary | null;
            originLat?: number | null;
            originLng?: number | null;
          };
        };

        if (data.item.type === "JOURNEY" && data.item.itineraryData) {
          // Reconstruct the journey by setting the itinerary
          setMode("plan");
          setPlanItineraries([data.item.itineraryData]);
          setPlanStatus("success");
          setSelectedItineraryIndex(0);
          setSelectedRoute(null);
          setViewingSavedJourney(true); // Flag that we're viewing a saved journey
        } else if (data.item.type === "ROUTE" && data.item.routeId) {
          // Load the saved bus route
          setMode("explore");
          try {
            const routesResponse = await fetch("/api/routes");
            if (routesResponse.ok) {
              const routesData = (await routesResponse.json()) as { routes: RouteSummary[] };
              const route = routesData.routes.find((r) => r.RouteId.toString() === data.item.routeId);
              if (route) {
                setSelectedRoute(route);
                setPlanItineraries(null);
                setJourneyStops([]);
              }
            }
          } catch (err) {
            console.error("Failed to load route:", err);
          }
        }
      } catch (error) {
        console.error("Error loading saved item:", error);
      }
    };

    void loadItem();
  }, [searchParams, session.status, session.user?.id]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      console.warn("Geolocation not supported in this browser");
      return;
    }

    const watcherId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
      },
      (error) => {
        console.error("Unable to retrieve current position", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000,
      }
    );

    return () => {
      if (typeof watcherId === "number") {
        navigator.geolocation.clearWatch(watcherId);
      }
    };
  }, []);

  useEffect(() => {
    if (!journeyStops.length) {
      setPlanStatus("idle");
      setPlanItineraries(null);
      setPlanError(null);
      setSelectedItineraryIndex(0);
      return;
    }

    if (!effectiveOrigin) {
      setPlanStatus("loading");
      setPlanError(null);
      return;
    }

    const controller = new AbortController();

    const plan = async () => {
      try {
        setPlanStatus("loading");
        setPlanError(null);

        const response = await fetch("/api/directions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            origin: effectiveOrigin,
            destinations: journeyStops.map((stop) => ({
              latitude: stop.latitude,
              longitude: stop.longitude,
            })),
            limit: 3,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as unknown;
          const errorMessage =
            errorPayload &&
            typeof errorPayload === "object" &&
            "error" in errorPayload &&
            typeof (errorPayload as { error?: unknown }).error === "string"
              ? ((errorPayload as { error: string }).error)
              : `Request failed with status ${response.status}`;
          throw new Error(errorMessage);
        }

        const rawData = (await response.json()) as unknown;
        const parsedItineraries = extractPlanItineraries(rawData);
        setPlanItineraries(parsedItineraries);
        setPlanStatus("success");
        setPlanError(null);
        setSelectedItineraryIndex(0);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to plan itinerary", error);
        setPlanStatus("error");
        setPlanError(error instanceof Error ? error.message : "Failed to calculate directions");
        setPlanItineraries(null);
      }
    };

    void plan();

    return () => {
      controller.abort();
    };
  }, [journeyStops, effectiveOrigin]);

  // Removed automatic route selection when itinerary changes
  // Routes should only be selected via the save bookmark button or manual route selection

  return (
    <>
      <OnboardingOverlay />
      <main className="relative min-h-screen">
        <RoutesSidebar
        mode={mode}
        onModeChange={setMode}
        selectedRouteId={selectedRoute?.RouteId}
        onSelectRoute={handleSelectRoute}
        selectedLocationId={activeDestination?.id}
        selectedLocation={activeDestination}
        journeyStops={journeyStops}
        onAddStop={handleAddStop}
        onRemoveStop={handleRemoveStop}
        onClearJourney={handleClearJourney}
        onPlanJourney={handlePlanJourney}
        userLocation={userLocation}
        manualOrigin={manualOrigin}
        onSetManualOrigin={setManualOrigin}
        itineraries={planItineraries}
        planStatus={planStatus}
        planError={planError}
        hasOrigin={Boolean(effectiveOrigin)}
        selectedItineraryIndex={selectedItineraryIndex}
        onSelectItinerary={handleSelectItinerary}
        viewingSavedJourney={viewingSavedJourney}
        onExitSavedJourneyView={() => setViewingSavedJourney(false)}
      />
      <MapboxMap
        selectedRoute={selectedRoute}
        selectedLocation={activeDestination}
        journeyStops={journeyStops}
        userLocation={effectiveOrigin}
        selectedItinerary={planItineraries?.[selectedItineraryIndex] ?? null}
      />
      </main>
    </>
  );
}
