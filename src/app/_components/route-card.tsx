"use client";

import { memo } from "react";
import { normalizeRouteColor } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/react";

type RouteSummary = RouterOutputs["bus"]["getRoutes"][number];

interface RouteCardProps {
  route: RouteSummary;
  isActive?: boolean;
  vehicleCount?: number;
  onClick?: () => void;
}

export const RouteCard = memo(function RouteCard({
  route,
  isActive = false,
  vehicleCount = 0,
  onClick,
}: RouteCardProps) {
  const color = normalizeRouteColor(route.Color);
  const subtitle = route.Description && route.Description.length > 0 ? route.Description : "";
  const statusText = vehicleCount > 0
    ? `${vehicleCount} bus${vehicleCount === 1 ? "" : "es"} active`
    : "No active buses";

  // Extract just the route number if it starts with "Route "
  const routeNumber = route.ShortName?.includes("Route ")
    ? route.ShortName.split("Route ")[1] ?? route.ShortName
    : route.ShortName ?? "";

  return (
    <button
      className={cn(
        "w-full relative max-w-full overflow-hidden rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        isActive && "border-blue-500 ring-2 ring-blue-500/40 bg-blue-50"
      )}
      aria-pressed={isActive}
      onClick={onClick}
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
            {routeNumber}
          </span>
        </div>
      </div>
    </button>
  );
});
