"use client";

import { useMemo, useState } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Search } from "lucide-react";
import type { RouterOutputs } from "@/trpc/react";

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];

interface RoutesListProps {
  routes?: RouteSummary[];
  isLoading: boolean;
  selectedRouteId?: number;
  vehiclesByRoute: Map<number, number>;
  onSelectRoute?: (route: RouteSummary) => void;
  requireAuth: (action: () => void | Promise<void>) => void;
}

export function RoutesList({
  routes,
  isLoading,
  selectedRouteId,
  vehiclesByRoute,
  onSelectRoute,
  requireAuth,
}: RoutesListProps) {
  const [routeQuery, setRouteQuery] = useState("");

  const filteredRoutes = useMemo(() => {
    if (!routes) return [];
    const q = routeQuery.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) =>
      [r.ShortName, r.LongName, r.Description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(q))
    );
  }, [routes, routeQuery]);

  const statusMessage = useMemo(() => {
    if (isLoading) return "Loading routes…";
    if (!routes?.length) return "No routes available.";
    if (!routeQuery.trim()) return `${routes.length} routes`;
    return `${filteredRoutes.length} routes match`;
  }, [isLoading, routes, filteredRoutes, routeQuery]);

  return (
    <>
      <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2">
        <Search className="h-4 w-4 opacity-60" />
        <input
          value={routeQuery}
          onChange={(event) => setRouteQuery(event.target.value)}
          placeholder="Search bus lines…"
          className="h-9 w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs opacity-60">
        {isLoading && (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        )}
        <span>{statusMessage}</span>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
          <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
            <ul className="space-y-2 p-2 pr-3">
              {filteredRoutes.map((route) => {
                const color = `#${(route.Color ?? "").trim()}`;
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
                          <div className="truncate text-sm text-muted-foreground">
                            {subtitle || route.LongName}
                          </div>
                          <div className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
                            {route.LongName || route.ShortName}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{statusText}</div>
                        </div>
                        <div className="text-right">
                          <span
                            className="block text-5xl font-extrabold leading-none tracking-tighter tabular-nums"
                            style={{ color }}
                          >
                            {route.ShortName.includes("Route ")
                              ? route.ShortName.split("Route ")[1]
                              : route.ShortName}
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
    </>
  );
}
