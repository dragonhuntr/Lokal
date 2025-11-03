"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type LayerProps, type MapRef } from "react-map-gl/mapbox";
import type {
  ColorSpecification,
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
} from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { env } from "@/env";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/react";
import type { LocationSearchResult } from "./routes-sidebar";
import { BusInfoPopup } from "./bus-info-popup";
import type { RouteDetails, RouteCoordinate } from "@/server/bus-api";
import { createBus3DLayer } from "./bus-3d-layer";
import type { PlanItinerary } from "@/server/routing/service";

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];

interface MapboxMapProps {
  selectedRoute?: RouteSummary | null;
  selectedLocation?: LocationSearchResult | null;
  journeyStops?: LocationSearchResult[] | null;
  userLocation?: { latitude: number; longitude: number } | null;
  selectedItinerary?: PlanItinerary | null;
}

interface NavigationRouteGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      distance?: number;
      duration?: number;
    };
    geometry: {
      type: "LineString";
      coordinates: [number, number][];
    };
  }>;
}

interface MapboxDirectionsResponse {
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][];
    };
    distance?: number;
    duration?: number;
  }>;
}

const DEFAULT_VIEW = {
  longitude: -79.982131,
  latitude: 42.118093,
  zoom: 15,
  pitch: 43,
  bearing: 0,
};

const ROUTE_SOURCE_ID = "selected-route";
const ROUTE_OUTLINE_LAYER_ID = "selected-route-outline";
const ROUTE_LINE_LAYER_ID = "selected-route-line";
const BUS_SOURCE_ID = "bus-positions";
const BUS_LAYER_ID = "bus-3d-layer";
const BUS_MODEL_SCALE: [number, number, number] = [18, 18, 18];

const NAVIGATION_SOURCE_ID = "navigation-route";
const NAVIGATION_LINE_LAYER_ID = "navigation-route-line";
const DIRECTIONS_PROFILE = "mapbox/walking";

const ITINERARY_SOURCE_ID = "itinerary-route";
const ITINERARY_WALK_LAYER_ID = "itinerary-walk-layer";
const ITINERARY_BUS_LAYER_ID = "itinerary-bus-layer";

/**
 * Interactive Mapbox map that renders bus routes, the user's location, and dynamic navigation
 * directions. The component integrates Mapbox's Directions API and 3D model layers for buses
 * while managing data fetching, state synchronization, and imperative Mapbox interactions.
 */
export function MapboxMap({
  selectedRoute,
  selectedLocation,
  journeyStops: journeyStopsProp,
  userLocation,
  selectedItinerary,
}: MapboxMapProps) {
  const [viewState, setViewState] = useState(DEFAULT_VIEW);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState<NavigationRouteGeoJSON | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<RouteDetails["Vehicles"][number] | null>(
    null
  );
  const directionsRequestIdRef = useRef(0);
  const hasCenteredUserRef = useRef(false);
  const mapRef = useRef<MapRef | null>(null);
  const bus3DLayerRef = useRef<mapboxgl.CustomLayerInterface | null>(null);
  const journeyStopList = Array.isArray(journeyStopsProp) ? journeyStopsProp : [];

  const routeId = selectedRoute?.RouteId;

  const { data: routeShape } = api.bus.getRouteKML.useQuery(
    { routeId: routeId ?? 0 },
    {
      enabled: routeId !== undefined && routeId !== null,
      staleTime: 5 * 60 * 1000,
    }
  );

  const { data: routeDetails } = api.bus.getRouteDetails.useQuery(
    { routeId: routeId ?? 0 },
    {
      enabled: routeId !== undefined && routeId !== null,
      refetchInterval: 10_000,
      select: (data) => ({
        ...data,
        Vehicles: data.Vehicles?.filter(
          (vehicle) =>
            Number.isFinite(vehicle.Latitude) &&
            Number.isFinite(vehicle.Longitude) &&
            (vehicle.Latitude !== 0 || vehicle.Longitude !== 0)
        ),
      }),
    }
  );

  useEffect(() => {
    if (!userLocation) return;
    if (hasCenteredUserRef.current) return;

    hasCenteredUserRef.current = true;
    setViewState((prev) => ({
      ...prev,
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      zoom: Math.max(prev.zoom, 16),
    }));
  }, [userLocation]);

  const routeColor = useMemo(() => {
    const raw = selectedRoute?.Color?.trim();
    if (!raw) return "#2563eb";
    return raw.startsWith("#") ? raw : `#${raw}`;
  }, [selectedRoute]);

  const routeGeoJson = useMemo(() => {
    if (!routeShape?.paths?.length) return null;

    const features = routeShape.paths
      .filter((path) => path.coordinates?.length)
      .map((path, index) => ({
        type: "Feature" as const,
        id: `${ROUTE_SOURCE_ID}-${index}`,
        properties: {
          name: path.name ?? `segment-${index}`,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: path.coordinates.map((coordinate) => [coordinate.longitude, coordinate.latitude]),
        },
      }));

    if (!features.length) return null;

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [routeShape]);

  const busGeoJson = useMemo(() => {
    if (!routeDetails?.Vehicles?.length) return null;

    const features = routeDetails.Vehicles.map((vehicle) => ({
      type: "Feature" as const,
      id: `vehicle-${vehicle.VehicleId}`,
      properties: {
        vehicleId: vehicle.VehicleId,
        name: vehicle.Name,
        rotation: [0, 0, vehicle.Heading ?? 0] as [number, number, number],
        scale: BUS_MODEL_SCALE,
        translation: [0, 0, 0] as [number, number, number],
        color: routeColor,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [vehicle.Longitude, vehicle.Latitude],
      },
    }));

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [routeDetails?.Vehicles, routeColor]);

  const routeOutlineLayer: LayerProps = useMemo(
    () => ({
      id: ROUTE_OUTLINE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      paint: {
        "line-color": "#ffffff",
        "line-width": 8,
        "line-opacity": 0.8,
      },
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
    }),
    []
  );

  const routeLineLayer: LayerProps = useMemo(
    () => ({
      id: ROUTE_LINE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      paint: {
        "line-color": routeColor,
        "line-width": 5,
        "line-opacity": 0.95,
      },
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
    }),
    [routeColor]
  );


  const handleMapClick = useCallback(
    (event: mapboxgl.MapLayerMouseEvent) => {
      const mapInstance = mapRef.current?.getMap();
      if (!mapInstance) return;

      // Check if we clicked on the bus layer
      const features = mapInstance.queryRenderedFeatures(event.point, {
        layers: [BUS_LAYER_ID],
      });

      if (features && features.length > 0) {
        const feature = features[0];
        const vehicleId = feature?.properties?.vehicleId as number | undefined;

        if (vehicleId && routeDetails?.Vehicles) {
          const vehicle = routeDetails.Vehicles.find((v) => v.VehicleId === vehicleId);
          if (vehicle) {
            setSelectedVehicle(vehicle);
          }
        }
      }
    },
    [routeDetails?.Vehicles]
  );

  // Click handler for 3D bus models
  useEffect(() => {
    const mapInstance = mapRef.current?.getMap();
    if (!mapInstance || !mapLoaded || !bus3DLayerRef.current) return;

    mapInstance.on("click", handleMapClick);

    return () => {
      mapInstance.off("click", handleMapClick);
    };
  }, [mapLoaded, handleMapClick]);

  useEffect(() => {
    if (selectedRoute) {
      setNavigationRoute(null);
      return;
    }

    if (!userLocation || journeyStopList.length === 0) {
      setNavigationRoute(null);
      return;
    }

    directionsRequestIdRef.current += 1;
    const requestId = directionsRequestIdRef.current;
    const controller = new AbortController();

    const fetchDirections = async () => {
      try {
        const coordinateParts = [
          `${userLocation.longitude},${userLocation.latitude}`,
          ...journeyStopList.map((stop) => `${stop.longitude},${stop.latitude}`),
        ];
        const coordinates = coordinateParts.join(";");
        const url = `https://api.mapbox.com/directions/v5/${DIRECTIONS_PROFILE}/${coordinates}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Directions request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as MapboxDirectionsResponse;

        if (requestId !== directionsRequestIdRef.current) {
          return;
        }

        const firstRoute = data.routes?.[0];
        if (firstRoute?.geometry?.coordinates?.length) {
          setNavigationRoute({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {
                  distance: firstRoute.distance,
                  duration: firstRoute.duration,
                },
                geometry: {
                  type: "LineString",
                  coordinates: firstRoute.geometry.coordinates,
                },
              },
            ],
          });
        } else {
          setNavigationRoute(null);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch Mapbox directions", error);
        if (requestId === directionsRequestIdRef.current) {
          setNavigationRoute(null);
        }
      }
    };

    void fetchDirections();

    return () => {
      controller.abort();
    };
  }, [selectedRoute, journeyStopList, userLocation]);

  useEffect(() => {
    if (!mapLoaded) return;

    const mapInstance = mapRef.current?.getMap();
    if (!mapInstance) return;

    if (!selectedRoute && navigationRoute?.features?.length) {
      const bounds = new mapboxgl.LngLatBounds();

      for (const feature of navigationRoute.features) {
        if (feature.geometry.type === "LineString") {
          for (const coordinate of feature.geometry.coordinates) {
            bounds.extend(coordinate);
          }
        }
      }

      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 120, right: 120 },
          maxZoom: 17,
          duration: 900,
        });
        return;
      }
    }

    if (selectedRoute && routeGeoJson?.features?.length) {
      const bounds = new mapboxgl.LngLatBounds();

      for (const feature of routeGeoJson.features) {
        if (feature.geometry.type === "LineString") {
          for (const coordinate of feature.geometry.coordinates) {
            bounds.extend(coordinate as [number, number]);
          }
        }
      }

      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds, {
          padding: 80,
          duration: 900,
          maxZoom: 16.5,
        });
        return;
      }
    }

    if (!selectedRoute && journeyStopList.length) {
      const target = journeyStopList[journeyStopList.length - 1];
      if (target) {
        mapInstance.flyTo({
          center: [target.longitude, target.latitude],
          zoom: Math.max(mapInstance.getZoom(), 16),
          duration: 900,
          essential: true,
        });
      }
      return;
    }

    if (!selectedRoute && selectedLocation) {
      mapInstance.flyTo({
        center: [selectedLocation.longitude, selectedLocation.latitude],
        zoom: Math.max(mapInstance.getZoom(), 16),
        duration: 900,
        essential: true,
      });
    }
  }, [mapLoaded, selectedRoute, selectedLocation, navigationRoute, routeGeoJson, journeyStopList]);

  const navigationLineLayer = useMemo<LayerProps>(
    () => ({
      id: NAVIGATION_LINE_LAYER_ID,
      type: "line",
      source: NAVIGATION_SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#2563eb",
        "line-width": 6,
        "line-opacity": 0.9,
        "line-blur": 0.2,
      },
    }),
    []
  );

  // Fetch Mapbox Directions for the entire itinerary
  const [itineraryDirections, setItineraryDirections] = useState<NavigationRouteGeoJSON | null>(null);
  const itineraryRequestIdRef = useRef(0);

  useEffect(() => {
    if (!selectedItinerary?.legs?.length || !userLocation) {
      setItineraryDirections(null);
      return;
    }

    itineraryRequestIdRef.current += 1;
    const requestId = itineraryRequestIdRef.current;
    const controller = new AbortController();

    const fetchItineraryDirections = async () => {
      try {
        // Build coordinate list: user location + all leg endpoints
        const coordinates: string[] = [];

        // Add user location as the starting point
        coordinates.push(`${userLocation.longitude},${userLocation.latitude}`);

        // Add each leg's endpoint
        selectedItinerary.legs.forEach((leg) => {
          coordinates.push(`${leg.end.longitude},${leg.end.latitude}`);
        });

        const coordinatesStr = coordinates.join(";");
        const url = `https://api.mapbox.com/directions/v5/${DIRECTIONS_PROFILE}/${coordinatesStr}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;

        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Directions request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as MapboxDirectionsResponse;

        if (requestId !== itineraryRequestIdRef.current) {
          return;
        }

        const firstRoute = data.routes?.[0];
        if (firstRoute?.geometry?.coordinates?.length) {
          setItineraryDirections({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {
                  distance: firstRoute.distance,
                  duration: firstRoute.duration,
                },
                geometry: {
                  type: "LineString",
                  coordinates: firstRoute.geometry.coordinates,
                },
              },
            ],
          });
        } else {
          setItineraryDirections(null);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch itinerary directions", error);
        if (requestId === itineraryRequestIdRef.current) {
          setItineraryDirections(null);
        }
      }
    };

    void fetchItineraryDirections();

    return () => {
      controller.abort();
    };
  }, [selectedItinerary, userLocation]);

  // Build GeoJSON for selected itinerary with colored segments based on leg types
  const itineraryGeoJson = useMemo(() => {
    if (!selectedItinerary?.legs?.length || !itineraryDirections) return null;

    const fullPath = itineraryDirections.features[0]?.geometry.coordinates;
    if (!fullPath?.length) return null;

    // Split the Mapbox Directions path into segments matching each leg
    const features = selectedItinerary.legs.map((leg, legIndex) => {
      // Find the closest point in the path to the leg's start
      let startIdx = 0;
      let minStartDist = Infinity;

      fullPath.forEach((coord, idx) => {
        const dist = Math.sqrt(
          Math.pow(coord[0] - leg.start.longitude, 2) +
          Math.pow(coord[1] - leg.start.latitude, 2)
        );
        if (dist < minStartDist) {
          minStartDist = dist;
          startIdx = idx;
        }
      });

      // Find the closest point in the path to the leg's end
      let endIdx = fullPath.length - 1;
      let minEndDist = Infinity;

      fullPath.forEach((coord, idx) => {
        if (idx <= startIdx) return; // Must be after start
        const dist = Math.sqrt(
          Math.pow(coord[0] - leg.end.longitude, 2) +
          Math.pow(coord[1] - leg.end.latitude, 2)
        );
        if (dist < minEndDist) {
          minEndDist = dist;
          endIdx = idx;
        }
      });

      // Extract the segment of the path for this leg
      const segmentCoordinates = fullPath.slice(startIdx, endIdx + 1);

      return {
        type: "Feature" as const,
        id: `leg-${legIndex}`,
        properties: {
          legType: leg.type,
          legIndex,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: segmentCoordinates.length > 0
            ? segmentCoordinates
            : [
                [leg.start.longitude, leg.start.latitude] as [number, number],
                [leg.end.longitude, leg.end.latitude] as [number, number],
              ],
        },
      };
    });

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [selectedItinerary, itineraryDirections]);

  // Walking segments layer (blue)
  const itineraryWalkLayer = useMemo<LayerProps>(
    () => ({
      id: ITINERARY_WALK_LAYER_ID,
      type: "line",
      source: ITINERARY_SOURCE_ID,
      filter: ["==", ["get", "legType"], "walk"],
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#2563eb", // Blue for walking
        "line-width": 5,
        "line-opacity": 0.8,
      },
    }),
    []
  );

  // Bus segments layer (orange)
  const itineraryBusLayer = useMemo<LayerProps>(
    () => ({
      id: ITINERARY_BUS_LAYER_ID,
      type: "line",
      source: ITINERARY_SOURCE_ID,
      filter: ["==", ["get", "legType"], "bus"],
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#ea580c", // Orange for bus
        "line-width": 6,
        "line-opacity": 0.9,
      },
    }),
    []
  );

  // Fit bounds to itinerary when selected
  useEffect(() => {
    if (!mapLoaded || !itineraryDirections?.features?.length) return;

    const mapInstance = mapRef.current?.getMap();
    if (!mapInstance) return;

    const bounds = new mapboxgl.LngLatBounds();

    for (const feature of itineraryDirections.features) {
      if (feature.geometry.type === "LineString") {
        for (const coordinate of feature.geometry.coordinates) {
          bounds.extend(coordinate as [number, number]);
        }
      }
    }

    if (!bounds.isEmpty()) {
      mapInstance.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 120, right: 120 },
        maxZoom: 16,
        duration: 900,
      });
    }
  }, [mapLoaded, itineraryDirections]);

  return (
    <div className="relative h-screen w-full">
      {selectedVehicle && (
        <BusInfoPopup vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        onLoad={() => setMapLoaded(true)}
        mapboxAccessToken={env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        style={{ width: "100%", height: "100%" }}
        mapStyle={env.NEXT_PUBLIC_MAPBOX_STYLE_ID}
      >
        {selectedRoute && routeGeoJson && (
          <Source id={ROUTE_SOURCE_ID} type="geojson" data={routeGeoJson}>
            <Layer {...routeOutlineLayer} />
            <Layer {...routeLineLayer} />
          </Source>
        )}

        {/* Render buses as simple SVG markers */}
        {selectedRoute &&
          routeDetails?.Vehicles?.map((vehicle) => (
            <Marker
              key={vehicle.VehicleId}
              latitude={vehicle.Latitude}
              longitude={vehicle.Longitude}
              anchor="center"
            >
              <div
                onClick={() => setSelectedVehicle(vehicle)}
                className="cursor-pointer transition-transform hover:scale-125"
                style={{
                  transform: `rotate(${vehicle.Heading ?? 0}deg)`,
                }}
              >
                <svg width="40" height="40" viewBox="0 0 40 40">
                  {/* Bus body */}
                  <rect
                    x="10"
                    y="12"
                    width="20"
                    height="16"
                    rx="2"
                    fill={routeColor}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {/* Windows */}
                  <rect x="12" y="15" width="6" height="5" rx="1" fill="#87ceeb" opacity="0.8" />
                  <rect x="22" y="15" width="6" height="5" rx="1" fill="#87ceeb" opacity="0.8" />
                  {/* Wheels */}
                  <circle cx="15" cy="28" r="3" fill="#333" />
                  <circle cx="25" cy="28" r="3" fill="#333" />
                  {/* Direction indicator (front) */}
                  <rect x="18" y="10" width="4" height="2" fill="#fff" />
                </svg>
              </div>
            </Marker>
          ))}

        {!selectedRoute && !selectedItinerary && navigationRoute && (
          <Source id={NAVIGATION_SOURCE_ID} type="geojson" data={navigationRoute}>
            <Layer {...navigationLineLayer} />
          </Source>
        )}

        {!selectedRoute && selectedItinerary && itineraryDirections && (
          <Source id={NAVIGATION_SOURCE_ID} type="geojson" data={itineraryDirections}>
            <Layer {...navigationLineLayer} />
          </Source>
        )}

        {!selectedRoute && selectedItinerary && itineraryGeoJson && (
          <Source id={ITINERARY_SOURCE_ID} type="geojson" data={itineraryGeoJson}>
            <Layer {...itineraryWalkLayer} />
            <Layer {...itineraryBusLayer} />
          </Source>
        )}

        {/* Render bus stops for the selected itinerary */}
        {!selectedRoute && selectedItinerary?.legs && selectedItinerary.legs.map((leg, legIndex) => {
          if (leg.type !== "bus" || !leg.path?.length) return null;

          return leg.path.map((stop, stopIndex) => {
            const isStart = stopIndex === 0;
            const isEnd = stopIndex === leg.path!.length - 1;
            const isIntermediate = !isStart && !isEnd;

            // Determine if this is a boarding or getting off stop
            // (start/end stops are shown as journey markers, so we mark them differently)
            const stopNumber = stop.sequence ?? stopIndex + 1;

            return (
              <Marker
                key={`bus-stop-${legIndex}-${stopIndex}`}
                latitude={stop.latitude}
                longitude={stop.longitude}
                anchor="center"
              >
                <div className="group relative flex items-center justify-center">
                  {/* Stop marker with different styles for start/end/intermediate */}
                  {isIntermediate ? (
                    // Intermediate stops: small orange dots
                    <div className="flex items-center justify-center">
                      <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-orange-500 shadow-md transition-all hover:scale-150 hover:bg-orange-600" />
                    </div>
                  ) : (
                    // Start/end stops: larger markers with numbers
                    <div className="flex items-center justify-center">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow-lg ${
                          isStart ? "bg-green-500 text-white" : "bg-red-500 text-white"
                        }`}
                        title={isStart ? "Board here" : "Get off here"}
                      >
                        {isStart ? "→" : "↓"}
                      </span>
                    </div>
                  )}

                  {/* Tooltip with stop name - shows on hover */}
                  {stop.stopName && (
                    <div className="pointer-events-none absolute bottom-full mb-2 hidden w-max max-w-xs rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                      <div className="font-semibold">{stop.stopName}</div>
                      <div className="text-[10px] text-gray-300">
                        Stop #{stopNumber}
                        {isStart && " • Board here"}
                        {isEnd && " • Get off here"}
                      </div>
                      {/* Arrow pointing down */}
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              </Marker>
            );
          });
        })}

        {!selectedRoute &&
          (journeyStopList.length
            ? journeyStopList.map((stop, index) => {
                const isFinal = index === journeyStopList.length - 1;
                return (
                  <Marker
                    key={`journey-stop-${stop.id}-${index}`}
                    latitude={stop.latitude}
                    longitude={stop.longitude}
                    anchor="bottom"
                  >
                    <div className="relative flex items-center justify-center">
                      <span
                        className={`absolute h-8 w-8 rounded-full blur-md ${
                          isFinal ? "bg-blue-500/30" : "bg-blue-400/20"
                        }`}
                      />
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-xs font-semibold shadow-lg ${
                          isFinal ? "bg-blue-600 text-white" : "bg-blue-200 text-blue-700"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </div>
                  </Marker>
                );
              })
            :
              selectedLocation && (
                <Marker latitude={selectedLocation.latitude} longitude={selectedLocation.longitude} anchor="bottom">
                  <div className="relative flex items-center justify-center">
                    <span className="absolute h-8 w-8 rounded-full bg-blue-500/30 blur-md" />
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-lg" />
                  </div>
                </Marker>
              ))}

        {userLocation && (
          <Marker latitude={userLocation.latitude} longitude={userLocation.longitude} anchor="center">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-8 w-8 rounded-full bg-sky-400/40 blur-md" />
              <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-sky-500 shadow-md" />
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}
