"use client";

import { memo } from "react";
import { Marker } from "react-map-gl/mapbox";
import { api } from "@/trpc/react";
import type { RouteDetails } from "@/server/bus-api";
import { formatETA } from "@/utils/format";

interface StopMarkerProps {
  stop: RouteDetails["Stops"][number];
  isFirst: boolean;
  isLast: boolean;
  routeColor: string;
  onHover: () => void;
  onUnhover: () => void;
  isHovered: boolean;
}

export const StopMarker = memo(function StopMarker({
  stop,
  isFirst,
  isLast,
  routeColor,
  onHover,
  onUnhover,
  isHovered,
}: StopMarkerProps) {
  const { data: stopETAs } = api.bus.getStopETAs.useQuery(
    { stopId: stop.StopId },
    {
      enabled: isHovered,
      staleTime: 30_000,
    }
  );

  return (
    <Marker
      key={stop.StopId}
      latitude={stop.Latitude}
      longitude={stop.Longitude}
      anchor="center"
    >
      <div
        className="group relative flex items-center justify-center"
        onMouseEnter={onHover}
        onMouseLeave={onUnhover}
      >
        <div className="flex items-center justify-center">
          <span
            className={`inline-block rounded-full border-2 border-white shadow-lg transition-all hover:scale-125 ${
              isFirst || isLast ? "h-5 w-5" : "h-3 w-3"
            }`}
            style={{
              backgroundColor: routeColor,
            }}
            title={stop.Name}
          />
        </div>

        {isHovered && (
          <div className="pointer-events-none absolute bottom-full mb-2 z-50 w-80 max-w-xs rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
            <div className="font-semibold mb-1">{stop.Name}</div>
            {stop.Description && (
              <div className="text-[10px] text-gray-300 mb-2">{stop.Description}</div>
            )}

            {stopETAs && stopETAs.length > 0 ? (
              <div className="mt-2 border-t border-gray-700 pt-2">
                <div className="text-[10px] font-semibold text-gray-400 mb-1">Next Departures:</div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {stopETAs.slice(0, 10).map((eta, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[10px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            eta.dataSource === "realtime" ? "bg-green-400" : "bg-gray-400"
                          }`}
                          title={eta.dataSource === "realtime" ? "Real-time" : "Scheduled"}
                        />
                        <span className="font-medium">{eta.routeNumber}</span>
                        <span className="text-gray-400 truncate max-w-[120px]">
                          {eta.headsign}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-200">{formatETA(eta.eta)}</span>
                    </div>
                  ))}
                  {stopETAs.length > 10 && (
                    <div className="text-[10px] text-gray-400 pt-1">
                      +{stopETAs.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            ) : stopETAs === undefined ? (
              <div className="mt-2 text-[10px] text-gray-400">Loading departures...</div>
            ) : (
              <div className="mt-2 text-[10px] text-gray-400">No departures scheduled</div>
            )}

            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>
    </Marker>
  );
});
