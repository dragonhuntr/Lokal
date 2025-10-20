"use client";

import { useCallback, useEffect, useState } from "react";
import { MapboxMap } from "@/app/_components/map";
import { RoutesSidebar, type LocationSearchResult } from "@/app/_components/routes-sidebar";
import type { PlanItinerary } from "@/server/routing/service";
import type { RouterOutputs } from "@/trpc/react";
import { api } from "@/trpc/react";

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];
type Coordinates = { latitude: number; longitude: number };
type PlanStatus = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteSummary | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [planItineraries, setPlanItineraries] = useState<PlanItinerary[] | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus>("idle");
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState(0);

  const { data: routes } = api.bus.getRoutes.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

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
    (index: number, itinerary: PlanItinerary) => {
      setSelectedItineraryIndex(index);

      if (!routes || !itinerary.routeId) {
        if (!itinerary.routeId) {
          setSelectedRoute(null);
        }
        return;
      }

      const numericRouteId = Number(String(itinerary.routeId).replace(/^\D+/u, ""));
      const matchingRoute = routes.find((route) => route.RouteId === numericRouteId) ?? null;
      setSelectedRoute(matchingRoute);
    },
    [routes]
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
          const errorPayload = await response.json().catch(() => null);
          throw new Error(errorPayload?.error ?? `Request failed with status ${response.status}`);
        }

        const data = (await response.json()) as { itineraries: PlanItinerary[] };
        setPlanItineraries(data.itineraries ?? null);
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

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    if (!planItineraries || !planItineraries.length) {
      setSelectedRoute(null);
      return;
    }

    const itinerary = planItineraries[selectedItineraryIndex] ?? planItineraries[0];
    if (!itinerary?.routeId) {
      setSelectedRoute(null);
      return;
    }

    if (!routes) {
      return;
    }

    const numericRouteId = Number(String(itinerary.routeId).replace(/^\D+/u, ""));
    const matchingRoute = routes.find((route) => route.RouteId === numericRouteId) ?? null;
    setSelectedRoute(matchingRoute);
  }, [planItineraries, selectedItineraryIndex, routes, selectedLocation]);

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
