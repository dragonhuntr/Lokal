"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "@/env";
import { extractContextNames } from "@/app/_components/utils/mapbox-helpers";
import type { LocationSearchResult, PlaceResult } from "@/types";

const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 10;

type SearchBoxSuggestResponse = {
  suggestions?: Array<{
    name?: string;
    mapbox_id: string;
    coordinates?: { latitude: number; longitude: number };
    place_formatted?: string;
    full_address?: string;
    address?: string;
    distance?: number;
    context?: unknown;
  }>;
};

type SearchBoxRetrieveResponse = {
  features?: Array<{
    properties?: {
      name?: string;
      mapbox_id?: string;
      place_formatted?: string;
      full_address?: string;
      address?: string;
      context?: unknown;
    };
    geometry?: {
      coordinates?: [number, number];
    };
  }>;
};

interface UseMapboxSearchOptions {
  proximity?: { latitude: number; longitude: number } | null;
  enabled?: boolean;
}

interface UseMapboxSearchReturn {
  results: PlaceResult[];
  isLoading: boolean;
  error: string | null;
  fetchLocationDetails: (mapboxId: string) => Promise<LocationSearchResult | null>;
  resetSessionToken: () => void;
}

export function useMapboxSearch(
  query: string,
  options: UseMapboxSearchOptions = {}
): UseMapboxSearchReturn {
  const { proximity, enabled = true } = options;
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const sessionTokenRef = useRef<string | null>(null);

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

  const fetchLocationDetails = useCallback(
    async (mapboxId: string): Promise<LocationSearchResult | null> => {
      try {
        const sessionToken = ensureSessionToken();
        const params = new URLSearchParams({
          session_token: sessionToken,
          access_token: env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
        });

        const response = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Mapbox retrieve error: ${response.status}`);
        }

        const data = (await response.json()) as SearchBoxRetrieveResponse;
        const feature = data.features?.[0];
        if (!feature) return null;

        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;

        const contextNames = extractContextNames(feature.properties?.context);

        return {
          id: feature.properties?.mapbox_id ?? mapboxId,
          name: feature.properties?.name ?? "",
          placeName:
            feature.properties?.place_formatted ??
            feature.properties?.full_address ??
            feature.properties?.name ??
            "",
          latitude: coords[1],
          longitude: coords[0],
          address: feature.properties?.full_address ?? feature.properties?.address,
          context: contextNames,
        };
      } catch (err) {
        console.error("Failed to retrieve place details from Mapbox", err);
        return null;
      }
    },
    [ensureSessionToken]
  );

  useEffect(() => {
    if (!enabled) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);

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

          if (proximity) {
            params.set("proximity", `${proximity.longitude},${proximity.latitude}`);
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
                    placeName:
                      suggestion.place_formatted ??
                      suggestion.full_address ??
                      suggestion.name ??
                      trimmed,
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude,
                    address: suggestion.full_address ?? suggestion.address,
                    context: contextNames,
                  }
                : null;

              return {
                mapboxId,
                name: suggestion.name ?? trimmed,
                placeName:
                  suggestion.place_formatted ??
                  suggestion.full_address ??
                  suggestion.name ??
                  trimmed,
                address: suggestion.full_address ?? suggestion.address,
                context: contextNames,
                distanceMeters: suggestion.distance ?? undefined,
                location: location ?? undefined,
              };
            }) ?? [];

          setResults(mapped);
          setError(null);
        } catch (err) {
          if (controller.signal.aborted) return;
          console.error("Failed to search locations via Mapbox", err);
          if (requestId === requestIdRef.current) {
            setResults([]);
            setError("We couldn't fetch locations. Please try again.");
          }
        } finally {
          if (requestId === requestIdRef.current) {
            setIsLoading(false);
          }
        }
      };

      void runSearch();
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query, proximity, enabled, ensureSessionToken]);

  return { results, isLoading, error, fetchLocationDetails, resetSessionToken };
}
