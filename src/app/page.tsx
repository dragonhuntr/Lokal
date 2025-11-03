"use client";

import { useCallback, useEffect, useState } from "react";
import { MapboxMap } from "@/app/_components/map";
import { RoutesSidebar, type LocationSearchResult } from "@/app/_components/routes-sidebar";
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
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [planItineraries, setPlanItineraries] = useState<PlanItinerary[] | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus>("idle");
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState(0);

  const handleSelectLocation = useCallback((location: LocationSearchResult) => {
    setSelectedRoute(null);
    setSelectedLocation(location);
    setPlanItineraries(null);
    setPlanStatus("loading");
    setPlanError(null);
    setSelectedItineraryIndex(0);
  }, []);

  const handleSelectRoute = useCallback((route: RouteSummary) => {
    setSelectedLocation(null);
    setPlanItineraries(null);
    setPlanStatus("idle");
    setPlanError(null);
    setSelectedItineraryIndex(0);
    setSelectedRoute(route);
  }, []);

  const handleSelectItinerary = useCallback(
    (index: number, _itinerary: PlanItinerary) => {
      setSelectedItineraryIndex(index);
      // Don't automatically select the route when an itinerary is clicked
      // Route selection should only happen via the save bookmark button or manual route selection
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
    if (!selectedLocation) {
      setPlanStatus("idle");
      setPlanItineraries(null);
      setPlanError(null);
      setSelectedItineraryIndex(0);
      return;
    }

    if (!userLocation) {
      // Keep status as loading to indicate we are waiting for location
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
            destination: {
              latitude: selectedLocation.latitude,
              longitude: selectedLocation.longitude,
            },
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
  }, [selectedLocation, userLocation]);

  // Removed automatic route selection when itinerary changes
  // Routes should only be selected via the save bookmark button or manual route selection

  return (
    <main className="relative min-h-screen">
      <RoutesSidebar
        selectedRouteId={selectedRoute?.RouteId}
        onSelectRoute={handleSelectRoute}
        selectedLocationId={selectedLocation?.id}
        selectedLocation={selectedLocation}
        onSelectLocation={handleSelectLocation}
        userLocation={userLocation}
        itineraries={planItineraries}
        planStatus={planStatus}
        planError={planError}
        hasOrigin={Boolean(userLocation)}
        selectedItineraryIndex={selectedItineraryIndex}
        onSelectItinerary={handleSelectItinerary}
      />
      <MapboxMap selectedRoute={selectedRoute} selectedLocation={selectedLocation} userLocation={userLocation} />
    </main>
  );
}
