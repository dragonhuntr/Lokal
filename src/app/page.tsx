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
  const [sharedJourneyDestinationName, setSharedJourneyDestinationName] = useState<string | null>(null);
  const [locationWatcherId, setLocationWatcherId] = useState<number | null>(null);
  const [savedJourneyOrigin, setSavedJourneyOrigin] = useState<Coordinates | null>(null);
  const [savedJourneyDestination, setSavedJourneyDestination] = useState<Coordinates | null>(null);

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
    setSharedJourneyDestinationName(null); // Clear shared journey destination name
    setSavedJourneyOrigin(null); // Clear saved journey origin
    setSavedJourneyDestination(null); // Clear saved journey destination
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
    setSharedJourneyDestinationName(null); // Clear shared journey destination name
    setSavedJourneyOrigin(null); // Clear saved journey origin
    setSavedJourneyDestination(null); // Clear saved journey destination
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

  // Handle journeyId from URL parameter (works for both authenticated and public access)
  useEffect(() => {
    const journeyIdParam = searchParams.get("journeyId");
    if (!journeyIdParam) {
      return;
    }

    // Wait for session to be loaded before checking auth
    if (session.status === "loading") {
      return;
    }

    const loadJourney = async () => {
      try {
        // Use the consolidated endpoint that handles both authenticated and public access
        const response = await fetch(`/api/journeys/${encodeURIComponent(journeyIdParam)}`, {
          credentials: "include",
        });
        
        if (!response.ok) {
          console.error("Failed to fetch journey");
          return;
        }

        const data = (await response.json()) as {
          journey?: {
            itineraryData: PlanItinerary;
            destinationName?: string | null;
            originLat?: number | null;
            originLng?: number | null;
            destinationLat?: number | null;
            destinationLng?: number | null;
          };
          route?: { routeId: string };
        };

        // Handle journey type
        if (data.journey?.itineraryData) {
          setMode("plan");
          setPlanItineraries([data.journey.itineraryData]);
          setPlanStatus("success");
          setPlanError(null);
          setSelectedItineraryIndex(0);
          setSelectedRoute(null);
          setViewingSavedJourney(true);
          // Always set destination name if available (works for both authenticated and public)
          setSharedJourneyDestinationName(data.journey.destinationName ?? null);
          // Store saved origin and destination coordinates for use when location is unavailable
          if (data.journey.originLat !== null && data.journey.originLat !== undefined &&
              data.journey.originLng !== null && data.journey.originLng !== undefined) {
            setSavedJourneyOrigin({
              latitude: data.journey.originLat,
              longitude: data.journey.originLng,
            });
          } else {
            setSavedJourneyOrigin(null);
          }
          if (data.journey.destinationLat !== null && data.journey.destinationLat !== undefined &&
              data.journey.destinationLng !== null && data.journey.destinationLng !== undefined) {
            setSavedJourneyDestination({
              latitude: data.journey.destinationLat,
              longitude: data.journey.destinationLng,
            });
          } else {
            setSavedJourneyDestination(null);
          }
        } 
        // Handle route type (only for authenticated users viewing their own saved routes)
        else if (data.route?.routeId) {
          setMode("explore");
          try {
            const routesResponse = await fetch("/api/routes");
            if (routesResponse.ok) {
              const routesData = (await routesResponse.json()) as { routes: RouteSummary[] };
              const route = routesData.routes.find((r) => r.RouteId === Number(data.route!.routeId));
              if (route) {
                setSelectedRoute(route);
                setPlanItineraries(null);
                setJourneyStops([]);
                setViewingSavedJourney(false);
                setSharedJourneyDestinationName(null);
              }
            }
          } catch (err) {
            console.error("Failed to load route:", err);
          }
        }
      } catch (error) {
        console.error("Error loading journey:", error);
      }
    };

    void loadJourney();
  }, [searchParams, session.status]);

  // Request location permission and start watching
  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      console.warn("Geolocation not supported in this browser");
      return;
    }

    // Check if we're in a secure context (HTTPS or localhost)
    const isSecureContext = window.isSecureContext || window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isSecureContext) {
      console.error("Geolocation requires HTTPS. Current protocol:", window.location.protocol);
      alert("Location access requires HTTPS. Please use https:// or localhost.");
      return;
    }

    // Clear any existing watcher
    if (locationWatcherId !== null) {
      navigator.geolocation.clearWatch(locationWatcherId);
    }

    let errorCount = 0;
    const MAX_ERRORS = 3;

    console.log("Requesting location permission...");

    // First, get current position (this triggers permission prompt on mobile Safari)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location permission granted, position received:", position.coords);
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });

        // Then start watching for updates
        const watcherId = navigator.geolocation.watchPosition(
          (pos) => {
            errorCount = 0;
            setUserLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
          (error) => {
            errorCount++;
            console.error(`Geolocation watch error (${errorCount}/${MAX_ERRORS}):`, error);

            if (errorCount >= MAX_ERRORS && watcherId !== null) {
              navigator.geolocation.clearWatch(watcherId);
              setLocationWatcherId(null);
              console.error("Geolocation disabled due to repeated errors");
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 1000,
          }
        );

        setLocationWatcherId(watcherId);
      },
      (error) => {
        // Safari may provide error object differently - handle safely
        // Error object should have: code (1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT)
        const errorCode = typeof error === "object" && error !== null && "code" in error ? error.code : null;
        const errorMessage = typeof error === "object" && error !== null && "message" in error ? error.message : String(error);
        
        // Log the full error object for debugging
        console.error("Geolocation error object:", error);
        console.error("Error type:", typeof error);
        console.error("Error code:", errorCode);
        console.error("Error message:", errorMessage);
        
        // Handle different error types
        if (errorCode === 1 || errorMessage?.toLowerCase().includes("denied")) {
          // PERMISSION_DENIED - Safari often returns this without showing prompt if previously denied
          console.warn("PERMISSION_DENIED: Location permission was denied or blocked by Safari");
          console.warn("This usually means permission was previously denied. To reset:");
          console.warn("1. iOS: Settings > Safari > Clear History and Website Data");
          console.warn("2. Or: Settings > Privacy & Security > Location Services > Safari Websites > Reset");
          console.warn("3. Then reload the page and try again");
          
          // Show user-friendly alert with instructions
          if (typeof window !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            alert(
              "Location access was denied. To enable:\n\n" +
              "1. Go to Settings > Safari\n" +
              "2. Tap 'Clear History and Website Data'\n" +
              "3. Or go to Settings > Privacy & Security > Location Services > Safari Websites\n" +
              "4. Set to 'Ask' or 'While Using App'\n" +
              "5. Reload this page and try again"
            );
          }
        } else if (errorCode === 2) {
          // POSITION_UNAVAILABLE
          console.warn("POSITION_UNAVAILABLE: Location unavailable. Check device location services.");
        } else if (errorCode === 3) {
          // TIMEOUT
          console.warn("TIMEOUT: Location request timed out. Try again.");
        } else {
          // Unknown error - log everything
          console.warn("Unknown geolocation error:", {
            error,
            errorType: typeof error,
            errorKeys: typeof error === "object" && error !== null ? Object.keys(error) : [],
            errorString: String(error),
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout for Safari
        maximumAge: 0, // Don't use cached position
      }
    );
  }, [locationWatcherId]);

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (locationWatcherId !== null) {
        navigator.geolocation.clearWatch(locationWatcherId);
      }
    };
  }, [locationWatcherId]);

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
    let isActive = true;

    const plan = async () => {
      try {
        if (!isActive) return;
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

        if (!isActive || controller.signal.aborted) return;

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

        if (!isActive || controller.signal.aborted) return;

        const parsedItineraries = extractPlanItineraries(rawData);
        setPlanItineraries(parsedItineraries);
        setPlanStatus("success");
        setPlanError(null);
        setSelectedItineraryIndex(0);
      } catch (error) {
        if (!isActive || controller.signal.aborted) return;

        console.error("Failed to plan itinerary", error);
        setPlanStatus("error");
        const errorMessage = error instanceof Error
          ? error.message
          : "Failed to calculate directions. Please check your internet connection and try again.";
        setPlanError(errorMessage);
        setPlanItineraries(null);
      }
    };

    plan().catch((error) => {
      console.error("Failed to plan journey:", error);
      if (isActive && !controller.signal.aborted) {
        setPlanStatus("error");
        setPlanError("Failed to calculate route. Please try again.");
      }
    });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [journeyStops, effectiveOrigin]);

  // Removed automatic route selection when itinerary changes
  // Routes should only be selected via the save bookmark button or manual route selection

  return (
    <>
      <OnboardingOverlay onRequestLocation={requestLocation} />
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
        sharedJourneyDestinationName={sharedJourneyDestinationName}
        onExitSavedJourneyView={() => {
          setViewingSavedJourney(false);
          setSharedJourneyDestinationName(null);
          setSavedJourneyOrigin(null);
          setSavedJourneyDestination(null);
        }}
      />
      <MapboxMap
        selectedRoute={selectedRoute}
        selectedLocation={activeDestination}
        journeyStops={journeyStops}
        userLocation={effectiveOrigin}
        selectedItinerary={planItineraries?.[selectedItineraryIndex] ?? null}
        savedJourneyOrigin={viewingSavedJourney ? savedJourneyOrigin : null}
        savedJourneyDestination={viewingSavedJourney ? savedJourneyDestination : null}
      />
      </main>
    </>
  );
}
