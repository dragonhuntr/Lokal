"use client";

import { useCallback, useEffect, useState } from "react";
import { MapboxMap } from "@/app/_components/map";
import { RoutesSidebar, type LocationSearchResult } from "@/app/_components/routes-sidebar";
import { OnboardingOverlay } from "@/app/_components/onboarding-overlay";
import type { PlanItinerary } from "@/server/routing/service";
import type { RouterOutputs } from "@/trpc/react";

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];
type Coordinates = { latitude: number; longitude: number };
type PlanStatus = "idle" | "loading" | "success" | "error";

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
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteSummary | null>(null);
  const [journeyStops, setJourneyStops] = useState<LocationSearchResult[]>([]);
  const [planItineraries, setPlanItineraries] = useState<PlanItinerary[] | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus>("idle");
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState(0);

  const activeDestination = journeyStops.length ? journeyStops[journeyStops.length - 1] : null;

  const handleAddStop = useCallback((location: LocationSearchResult) => {
    setSelectedRoute(null);
    setJourneyStops((previous) => {
      const withoutDuplicate = previous.filter((stop) => stop.id !== location.id);
      return [...withoutDuplicate, location];
    });
    setPlanItineraries(null);
    setPlanStatus("loading");
    setPlanError(null);
    setSelectedItineraryIndex(0);
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
  }, []);

  const handleSelectRoute = useCallback((route: RouteSummary) => {
    setJourneyStops([]);
    setPlanItineraries(null);
    setPlanStatus("idle");
    setPlanError(null);
    setSelectedItineraryIndex(0);
    setSelectedRoute(route);
  }, []);

  const handleSelectItinerary = useCallback(
    (index: number, _itinerary: PlanItinerary) => {
      setSelectedItineraryIndex(index);
      // Clear route selection when selecting an itinerary to show the itinerary visualization
      setSelectedRoute(null);
    },
    []
  );

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

    if (!userLocation) {
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
            origin: userLocation,
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
  }, [journeyStops, userLocation]);

  // Removed automatic route selection when itinerary changes
  // Routes should only be selected via the save bookmark button or manual route selection

  return (
    <>
      <OnboardingOverlay />
      <main className="relative min-h-screen">
        <RoutesSidebar
        selectedRouteId={selectedRoute?.RouteId}
        onSelectRoute={handleSelectRoute}
        selectedLocationId={activeDestination?.id}
        selectedLocation={activeDestination}
        journeyStops={journeyStops}
        onAddStop={handleAddStop}
        onRemoveStop={handleRemoveStop}
        onClearJourney={handleClearJourney}
        userLocation={userLocation}
        itineraries={planItineraries}
        planStatus={planStatus}
        planError={planError}
        hasOrigin={Boolean(userLocation)}
        selectedItineraryIndex={selectedItineraryIndex}
        onSelectItinerary={handleSelectItinerary}
      />
      <MapboxMap
        selectedRoute={selectedRoute}
        selectedLocation={activeDestination}
        journeyStops={journeyStops}
        userLocation={userLocation}
        selectedItinerary={planItineraries?.[selectedItineraryIndex] ?? null}
      />
      </main>
    </>
  );
}
