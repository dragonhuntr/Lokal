"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/trpc/session";
import type { PlanItinerary } from "@/server/routing/service";

export type ItemType = "ROUTE" | "JOURNEY";

export interface SavedItemBase {
  id: string;
  userId: string;
  nickname: string | null;
  type: ItemType;
  lastViewed: string | null;
  createdAt: string;
}

export interface SavedRouteItem extends SavedItemBase {
  type: "ROUTE";
  routeId: string;
  itineraryData: null;
  originLat: null;
  originLng: null;
  totalDistance: null;
  totalDuration: null;
}

export interface SavedJourneyItem extends SavedItemBase {
  type: "JOURNEY";
  routeId: null;
  itineraryData: PlanItinerary;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  destinationName: string | null;
  totalDistance: number;
  totalDuration: number;
}

export type SavedItem = SavedRouteItem | SavedJourneyItem;

export function useSavedItems() {
  const { user, status } = useSession();
  const queryClient = useQueryClient();

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["savedItems", user?.id],
    queryFn: async () => {
      if (!user) return [] as SavedItem[];
      const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/saved-items`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load saved items");
      const json = (await res.json()) as { items: SavedItem[] };
      return json.items;
    },
    enabled: status === "authenticated" && !!user?.id,
  });

  const saveJourney = useCallback(
    async (itineraryData: PlanItinerary, originLat: number, originLng: number, nickname?: string, destinationName?: string) => {
      if (!user) throw new Error("Not authenticated");
      
      // Extract destination coordinates from the last leg's end point
      const lastLeg = itineraryData.legs[itineraryData.legs.length - 1];
      if (!lastLeg) {
        throw new Error("Invalid itinerary: no legs found");
      }
      const destinationLat = lastLeg.end.latitude;
      const destinationLng = lastLeg.end.longitude;
      
      const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/saved-items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "JOURNEY",
          itineraryData,
          originLat,
          originLng,
          destinationLat,
          destinationLng,
          nickname,
          destinationName,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save journey");
      await queryClient.invalidateQueries({ queryKey: ["savedItems", user.id] });
    },
    [user, queryClient]
  );

  const saveRoute = useCallback(
    async (routeId: string, nickname?: string) => {
      if (!user) throw new Error("Not authenticated");
      const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/saved-items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "ROUTE",
          routeId,
          nickname,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save route");
      await queryClient.invalidateQueries({ queryKey: ["savedItems", user.id] });
    },
    [user, queryClient]
  );

  const remove = useCallback(
    async (itemId: string) => {
      if (!user) throw new Error("Not authenticated");
      const res = await fetch(
        `/api/user/${encodeURIComponent(user.id)}/saved-items/${encodeURIComponent(itemId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Failed to remove saved item");
      await queryClient.invalidateQueries({ queryKey: ["savedItems", user.id] });
    },
    [user, queryClient]
  );

  // Helper to get only journeys
  const journeys = (data ?? []).filter((item): item is SavedJourneyItem => item.type === "JOURNEY");

  // Helper to get only routes
  const routes = (data ?? []).filter((item): item is SavedRouteItem => item.type === "ROUTE");

  return {
    items: data ?? [],
    journeys,
    routes,
    isFetching,
    refetch,
    saveJourney,
    saveRoute,
    remove,
  };
}
