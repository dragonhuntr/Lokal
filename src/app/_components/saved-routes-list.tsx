"use client";

import { useMemo } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Bookmark } from "lucide-react";
import type { RouterOutputs } from "@/trpc/react";
import type { useSavedItems } from "@/trpc/saved-items";

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];

interface SavedRoutesListProps {
  savedRoutes: ReturnType<typeof useSavedItems>["routes"];
  allRoutes?: RouteSummary[];
  selectedRouteId?: number;
  vehiclesByRoute: Map<number, number>;
  hasVehiclesLoaded: boolean;
  onSelectRoute?: (route: RouteSummary) => void;
  onViewOnMap: (itemId: string) => void;
  searchQuery?: string;
}

export function SavedRoutesList({
  savedRoutes,
  allRoutes,
  selectedRouteId,
  vehiclesByRoute,
  hasVehiclesLoaded,
  onSelectRoute,
  onViewOnMap,
  searchQuery = "",
}: SavedRoutesListProps) {
  // Match saved routes with actual route data and filter by search query
  const matchedRoutes = useMemo(() => {
    if (!allRoutes || savedRoutes.length === 0) return [];
    
    const q = searchQuery.trim().toLowerCase();
    
    return savedRoutes
      .map((savedRoute) => {
        const route = allRoutes.find((r) => r.RouteId === Number(savedRoute.routeId));
        if (!route) return null;
        
        // Filter by search query if provided
        if (q) {
          const matchesSearch = [route.ShortName, route.LongName, route.Description]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(q));
          if (!matchesSearch) return null;
        }
        
        return { route, savedRoute };
      })
      .filter((item): item is { route: RouteSummary; savedRoute: typeof savedRoutes[0] } => item !== null);
  }, [savedRoutes, allRoutes, searchQuery]);

  if (matchedRoutes.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2 text-xs opacity-60">
        <Bookmark className="h-3.5 w-3.5" />
        <span>Saved Routes ({matchedRoutes.length})</span>
      </div>
      <div className="rounded-md border">
        <ScrollArea.Root className="h-full w-full overflow-hidden">
          <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
            <ul className="space-y-2 p-2 pr-3">
              {matchedRoutes.map(({ route, savedRoute }) => {
                const colorValue = (route.Color ?? "").trim();
                const color = colorValue ? `#${colorValue}` : "#2563eb";
                const subtitle = route.Description && route.Description.length > 0 ? route.Description : "";
                const isActive = route.RouteId === selectedRouteId;
                const vehicleCount = vehiclesByRoute.get(route.RouteId) ?? 0;
                const statusText = vehicleCount > 0
                  ? `${vehicleCount} bus${vehicleCount === 1 ? "" : "es"} active`
                  : "No active buses";

                return (
                  <li key={savedRoute.id}>
                    <button
                      className={`w-full relative max-w-full overflow-hidden rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                        isActive ? "border-blue-500 ring-2 ring-blue-500/40 bg-blue-50" : ""
                      }`}
                      aria-pressed={isActive}
                      onClick={() => onSelectRoute?.(route)}
                      title={route.LongName}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-xs sm:text-sm text-muted-foreground">
                            {subtitle}
                          </div>
                          <div className="mt-1 truncate text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                            {route.LongName}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{statusText}</div>
                        </div>
                        <div className="text-right">
                          <span
                            className="block text-3xl sm:text-4xl md:text-5xl font-extrabold leading-none tracking-tighter tabular-nums"
                            style={{ color }}
                          >
                            {route.ShortName?.includes("Route ")
                              ? route.ShortName.split("Route ")[1] ?? route.ShortName
                              : route.ShortName ?? ""}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb className="rounded-full bg-border/60" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      </div>
    </div>
  );
}

