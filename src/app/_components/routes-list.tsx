"use client";

import { useMemo, useState } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Bus, Search } from "lucide-react";
import type { RouterOutputs } from "@/trpc/react";

import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];

interface RoutesListProps {
  routes?: RouteSummary[];
  isLoading: boolean;
  selectedRouteId?: number;
  vehiclesByRoute: Map<number, number>;
  hasVehiclesLoaded: boolean;
  onSelectRoute?: (route: RouteSummary) => void;
  requireAuth: (action: () => void | Promise<void>) => void;
  excludeRouteIds?: Set<number>;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export function RoutesList({
  routes,
  isLoading,
  selectedRouteId,
  vehiclesByRoute,
  hasVehiclesLoaded,
  onSelectRoute,
  requireAuth: _requireAuth,
  excludeRouteIds,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
}: RoutesListProps) {
  const [internalRouteQuery, setInternalRouteQuery] = useState("");
  const routeQuery = externalSearchQuery ?? internalRouteQuery;
  const setRouteQuery = onSearchQueryChange ?? setInternalRouteQuery;

  const filteredRoutes = useMemo(() => {
    if (!routes) return [];
    
    // First filter out saved routes if excludeRouteIds is provided
    let availableRoutes = routes;
    if (excludeRouteIds && excludeRouteIds.size > 0) {
      availableRoutes = routes.filter((r) => !excludeRouteIds.has(r.RouteId));
    }
    
    // Then filter by active buses (only if vehicles data has loaded)
    let activeRoutes = availableRoutes;
    if (hasVehiclesLoaded) {
      activeRoutes = availableRoutes.filter((r) => {
        const vehicleCount = vehiclesByRoute.get(r.RouteId) ?? 0;
        return vehicleCount > 0;
      });
    }
    
    // Finally filter by search query
    const q = routeQuery.trim().toLowerCase();
    if (!q) return activeRoutes;
    return activeRoutes.filter((r) =>
      [r.ShortName, r.LongName, r.Description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(q))
    );
  }, [routes, routeQuery, vehiclesByRoute, hasVehiclesLoaded, excludeRouteIds]);

  const statusMessage = useMemo(() => {
    if (isLoading) return "Loading routes…";
    if (!routes?.length) return "No routes available.";
    if (!routeQuery.trim()) return;
    return `${filteredRoutes.length} route${filteredRoutes.length === 1 ? "" : "s"} match`;
  }, [isLoading, routes, filteredRoutes, routeQuery, hasVehiclesLoaded]);

  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-xs opacity-60">
        <Bus className="h-3.5 w-3.5" />
        <span>Active Routes</span>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs opacity-60">
        {isLoading && <Spinner size="sm" className="text-blue-600" />}
        <span>{statusMessage}</span>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
          <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
            <ul className="space-y-2 p-2 pr-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <li key={index}>
                    <div className="w-full rounded-2xl border bg-card px-4 py-4">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                        <div className="min-w-0 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-7 w-full" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-12 w-12 rounded-md" />
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                filteredRoutes.map((route) => {
                const colorValue = (route.Color ?? "").trim();
                const color = colorValue ? `#${colorValue}` : "#2563eb";
                const subtitle = route.Description && route.Description.length > 0 ? route.Description : "";
                const isActive = route.RouteId === selectedRouteId;
                const vehicleCount = vehiclesByRoute.get(route.RouteId) ?? 0;
                const statusText = vehicleCount > 0
                  ? `${vehicleCount} bus${vehicleCount === 1 ? "" : "es"} active`
                  : "No active buses";

                return (
                  <li key={route.RouteId}>
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
              })
              )}
            </ul>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb className="rounded-full bg-border/60" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      </div>
    </>
  );
}
