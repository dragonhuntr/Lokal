"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/trpc/session";

export interface SavedRouteListItem {
  id: string;
  routeId: string;
  nickname: string | null;
  createdAt: string;
  route: {
    id: string;
    name: string;
    number: string;
    origin: string;
    destination: string;
    totalStops: number;
    duration: number;
  };
}

export function useSavedRoutes() {
  const { user, status } = useSession();
  const queryClient = useQueryClient();

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["savedRoutes", user?.id],
    queryFn: async () => {
      if (!user) return [] as SavedRouteListItem[];
      const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/saved-routes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load saved routes");
      const json = (await res.json()) as { savedRoutes: SavedRouteListItem[] };
      return json.savedRoutes;
    },
    enabled: status === "authenticated" && !!user?.id,
  });

  const save = useCallback(async (routeId: string, nickname?: string) => {
    if (!user) throw new Error("Not authenticated");
    const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/saved-routes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ routeId, nickname }),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to save route");
    await queryClient.invalidateQueries({ queryKey: ["savedRoutes", user.id] });
  }, [user, queryClient]);

  const remove = useCallback(async (routeId: string) => {
    if (!user) throw new Error("Not authenticated");
    const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/saved-routes/${encodeURIComponent(routeId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to remove saved route");
    await queryClient.invalidateQueries({ queryKey: ["savedRoutes", user.id] });
  }, [user, queryClient]);

  const isSaved = useCallback((routeId: string) => {
    return (data ?? []).some((s) => s.routeId === routeId);
  }, [data]);

  return { routes: data ?? [], isFetching, refetch, save, remove, isSaved };
}


