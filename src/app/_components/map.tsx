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

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];

interface MapboxMapProps {
  selectedRoute?: RouteSummary | null;
  selectedLocation?: LocationSearchResult | null;
  userLocation?: { latitude: number; longitude: number } | null;
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

type MapWithModelAPI = ReturnType<MapRef["getMap"]> & {
  addModel?: (id: string, url: string) => void;
  hasModel?: (id: string) => boolean;
};

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
const BUS_LAYER_ID = "bus-model-layer";
const BUS_MODEL_ID = "bus-3d-model";
const BUS_MODEL_SCALE: [number, number, number] = [18, 18, 18];

const GET_MODEL_ID_EXPRESSION = ["get", "modelId"] as const satisfies ExpressionSpecification;
const GET_MODEL_SCALE_EXPRESSION = ["get", "scale"] as const satisfies ExpressionSpecification;
const GET_MODEL_ROTATION_EXPRESSION = ["get", "rotation"] as const satisfies ExpressionSpecification;
const GET_MODEL_TRANSLATION_EXPRESSION = ["get", "translation"] as const satisfies ExpressionSpecification;

const NAVIGATION_SOURCE_ID = "navigation-route";
const NAVIGATION_LINE_LAYER_ID = "navigation-route-line";
const DIRECTIONS_PROFILE = "mapbox/walking";

function buildModelColorExpression(
  fallback: string,
): DataDrivenPropertyValueSpecification<ColorSpecification> {
  return ["coalesce", ["get", "color"], fallback] as ExpressionSpecification;
}

type ModelVector = [number, number, number];

const MODEL_SCALE: DataDrivenPropertyValueSpecification<ModelVector> = GET_MODEL_SCALE_EXPRESSION;
const MODEL_ROTATION: DataDrivenPropertyValueSpecification<ModelVector> = GET_MODEL_ROTATION_EXPRESSION;
const MODEL_TRANSLATION: DataDrivenPropertyValueSpecification<ModelVector> =
  GET_MODEL_TRANSLATION_EXPRESSION;
const MODEL_ID: DataDrivenPropertyValueSpecification<string> = GET_MODEL_ID_EXPRESSION;

/**
 * Interactive Mapbox map that renders bus routes, the user's location, and dynamic navigation
 * directions. The component integrates Mapbox's Directions API and 3D model layers for buses
 * while managing data fetching, state synchronization, and imperative Mapbox interactions.
 */
export function MapboxMap({ selectedRoute, selectedLocation, userLocation }: MapboxMapProps) {
  const [viewState, setViewState] = useState(DEFAULT_VIEW);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState<NavigationRouteGeoJSON | null>(null);
  const directionsRequestIdRef = useRef(0);
  const hasCenteredUserRef = useRef(false);
  const mapRef = useRef<MapRef | null>(null);

  const routeId = selectedRoute?.RouteId ?? null;

  const { data: routeShape } = api.bus.getRouteKML.useQuery(
    { routeId: routeId ?? -1 },
    {
      enabled: routeId !== null,
      staleTime: 5 * 60 * 1000,
    }
  );

  const { data: routeDetails } = api.bus.getRouteDetails.useQuery(
    { routeId: routeId ?? -1 },
    {
      enabled: routeId !== null,
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
        modelId: BUS_MODEL_ID,
        rotation: [0, 0, vehicle.Heading ?? 0],
        scale: BUS_MODEL_SCALE,
        translation: [0, 0, 0],
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

  const busModelLayer = useMemo(
    () =>
      ({
        id: BUS_LAYER_ID,
        type: "model",
        source: BUS_SOURCE_ID,
        layout: {
          "model-id": MODEL_ID,
        },
        paint: {
          "model-scale": MODEL_SCALE,
          "model-rotation": MODEL_ROTATION,
          "model-translation": MODEL_TRANSLATION,
          "model-emissive-strength": 0.75,
          "model-color": buildModelColorExpression(routeColor),
          "model-type": "common-3d",
          "model-cast-shadows": true,
          "model-receive-shadows": true,
        },
      }) satisfies LayerProps,
    [routeColor]
  );

  const ensureBusModelLoaded = useCallback(() => {
    const mapInstance = mapRef.current?.getMap() as MapWithModelAPI | undefined;
    if (!mapInstance) return;

    const addModel = mapInstance.addModel?.bind(mapInstance);
    const hasModel = mapInstance.hasModel?.bind(mapInstance);

    if (!addModel || !hasModel) return;

    try {
      if (!hasModel(BUS_MODEL_ID)) {
        addModel(BUS_MODEL_ID, "/Bus.glb");
      }
      setModelReady(true);
    } catch (error) {
      console.error("Failed to register bus model", error);
    }
  }, []);

  useEffect(() => {
    if (!mapLoaded || !selectedRoute) return;
    ensureBusModelLoaded();

    const mapInstance = mapRef.current?.getMap() as MapWithModelAPI | undefined;
    if (!mapInstance || typeof mapInstance.on !== "function") return;

    const handleStyleData = () => ensureBusModelLoaded();
    mapInstance.on("styledata", handleStyleData);

    return () => {
      mapInstance.off?.("styledata", handleStyleData);
    };
  }, [ensureBusModelLoaded, mapLoaded, selectedRoute]);

  useEffect(() => {
    if (selectedRoute) {
      setNavigationRoute(null);
      return;
    }

    if (!selectedLocation || !userLocation) {
      setNavigationRoute(null);
      return;
    }

    directionsRequestIdRef.current += 1;
    const requestId = directionsRequestIdRef.current;
    const controller = new AbortController();

    const fetchDirections = async () => {
      try {
        const coordinates = `${userLocation.longitude},${userLocation.latitude};${selectedLocation.longitude},${selectedLocation.latitude}`;
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
  }, [selectedRoute, selectedLocation, userLocation]);

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

    if (!selectedRoute && selectedLocation) {
      mapInstance.flyTo({
        center: [selectedLocation.longitude, selectedLocation.latitude],
        zoom: Math.max(mapInstance.getZoom(), 16),
        duration: 900,
        essential: true,
      });
    }
  }, [mapLoaded, selectedRoute, selectedLocation, navigationRoute, routeGeoJson]);

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

  return (
    <div className="h-screen w-full">
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

        {selectedRoute && modelReady && busGeoJson && (
          <Source id={BUS_SOURCE_ID} type="geojson" data={busGeoJson}>
            <Layer {...busModelLayer} />
          </Source>
        )}

        {selectedRoute &&
          !modelReady &&
          routeDetails?.Vehicles?.map((vehicle) => (
            <Marker key={vehicle.VehicleId} latitude={vehicle.Latitude} longitude={vehicle.Longitude} anchor="center">
              <div className="h-3 w-3 rounded-full border border-white bg-blue-500 shadow" />
            </Marker>
          ))}

        {!selectedRoute && navigationRoute && (
          <Source id={NAVIGATION_SOURCE_ID} type="geojson" data={navigationRoute}>
            <Layer {...navigationLineLayer} />
          </Source>
        )}

        {!selectedRoute && selectedLocation && (
          <Marker latitude={selectedLocation.latitude} longitude={selectedLocation.longitude} anchor="bottom">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-8 w-8 rounded-full bg-blue-500/30 blur-md" />
              <span className="inline-block h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-lg" />
            </div>
          </Marker>
        )}

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
