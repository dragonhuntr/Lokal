"use client";

import { useCallback, useEffect, useState } from "react";
import { MapboxMap } from "@/app/_components/map";
import { RoutesSidebar, type LocationSearchResult } from "@/app/_components/routes-sidebar";
import type { RouterOutputs } from "@/trpc/react";

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];
type Coordinates = { latitude: number; longitude: number };

export default function Home() {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteSummary | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);

  const handleSelectLocation = useCallback((location: LocationSearchResult) => {
    setSelectedRoute(null);
    setSelectedLocation(location);
  }, []);

  const handleSelectRoute = useCallback((route: RouteSummary) => {
    setSelectedLocation(null);
    setSelectedRoute(route);
  }, []);

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

  return (
    <main className="relative min-h-screen">
      <RoutesSidebar
        selectedRouteId={selectedRoute?.RouteId}
        onSelectRoute={handleSelectRoute}
        selectedLocationId={selectedLocation?.id}
        onSelectLocation={handleSelectLocation}
        userLocation={userLocation}
      />
      <MapboxMap selectedRoute={selectedRoute} selectedLocation={selectedLocation} userLocation={userLocation} />
    </main>
  );
}
