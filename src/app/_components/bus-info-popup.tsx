"use client";

import type { RouteDetails } from "@/server/bus-api";
import { getOccupancyLabel, getOccupancyColor } from "@/lib/bus-utils";

interface BusInfoPopupProps {
  vehicle: RouteDetails["Vehicles"][number];
  onClose: () => void;
}

export function BusInfoPopup({ vehicle, onClose }: BusInfoPopupProps) {
  const formatSpeed = (speed: number) => {
    return `${Math.round(speed)} km/h`;
  };

  const formatLastUpdated = (lastUpdated: string) => {
    try {
      const date = new Date(lastUpdated);
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSeconds < 60) return "Just now";
      if (diffSeconds < 120) return "1 min ago";
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} mins ago`;

      return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popup */}
      <div className="fixed left-1/2 top-20 z-50 w-80 -translate-x-1/2 transform animate-in fade-in slide-in-from-top-4 rounded-lg border border-gray-200 bg-white shadow-2xl duration-200">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100 p-4">
          <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M8 7v10m8-10v10M5 17h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{vehicle.Name}</h3>
            <p className="text-xs text-gray-500">Vehicle #{vehicle.VehicleId}</p>
          </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500">Destination</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{vehicle.Destination || "N/A"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-2">
            <p className="text-xs font-medium text-gray-500">Direction</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{vehicle.Direction || "N/A"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-2">
            <p className="text-xs font-medium text-gray-500">Speed</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{formatSpeed(vehicle.Speed)}</p>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 p-2">
          <p className="text-xs font-medium text-gray-500">Last Stop</p>
          <p className="mt-1 text-sm text-gray-900">{vehicle.LastStop || "N/A"}</p>
        </div>

        {vehicle.OccupancyStatusReportLabel && (
          <div>
            <p className="text-xs font-medium text-gray-500">Occupancy</p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-medium ${getOccupancyColor(
                vehicle.OccupancyStatusReportLabel,
              )}`}
            >
              {getOccupancyLabel(vehicle.OccupancyStatusReportLabel)}
            </span>
          </div>
        )}

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Updated: {formatLastUpdated(vehicle.LastUpdated)}
          </p>
        </div>
        </div>
      </div>
    </>
  );
}
