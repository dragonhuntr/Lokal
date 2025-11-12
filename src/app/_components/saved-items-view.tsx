"use client";

import { useState } from "react";
import { MapPin, Bus, Calendar, Navigation, Share2, Trash2 } from "lucide-react";
import type { useSavedItems } from "@/trpc/saved-items";

interface SavedItemsViewProps {
  items: ReturnType<typeof useSavedItems>;
  filter: "all" | "journeys" | "routes";
  onFilterChange: (filter: "all" | "journeys" | "routes") => void;
  deleteConfirm: string | null;
  onDeleteConfirm: (id: string | null) => void;
  onViewOnMap: (itemId: string) => void;
  onDelete: (itemId: string) => Promise<void>;
}

export function SavedItemsView({
  items,
  filter,
  onFilterChange,
  deleteConfirm,
  onDeleteConfirm,
  onViewOnMap,
  onDelete,
}: SavedItemsViewProps) {
  const [copiedJourneyId, setCopiedJourneyId] = useState<string | null>(null);
  const filteredItems = filter === "all"
    ? items.items
    : filter === "journeys"
    ? items.journeys
    : items.routes;

  return (
    <div className="flex flex-col gap-3 flex-1 overflow-hidden">
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b pb-2" role="tablist" aria-label="Saved items filter">
        <button
          role="tab"
          aria-selected={filter === "all"}
          onClick={() => onFilterChange("all")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-md focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
            filter === "all"
              ? "bg-blue-50 text-blue-600"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All ({items.items.length})
        </button>
        <button
          role="tab"
          aria-selected={filter === "journeys"}
          onClick={() => onFilterChange("journeys")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-md focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
            filter === "journeys"
              ? "bg-blue-50 text-blue-600"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          Journeys ({items.journeys.length})
        </button>
        <button
          role="tab"
          aria-selected={filter === "routes"}
          onClick={() => onFilterChange("routes")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-md focus:outline-2 focus:outline-offset-2 focus:outline-ring ${
            filter === "routes"
              ? "bg-blue-50 text-blue-600"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          Routes ({items.routes.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <MapPin className="w-12 h-12 text-muted-foreground/30 mb-3" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground mb-1">
              No saved items yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Start planning journeys and saving your favorite routes to see them here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="border rounded-lg p-3 bg-background hover:shadow-md transition-shadow"
              >
                {/* Item Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-foreground truncate mb-1">
                      {item.nickname ?? "Untitled"}
                    </h3>
                    {item.type === "JOURNEY" ? (
                      <JourneyDetails journey={item} />
                    ) : (
                      <RouteDetails route={item} />
                    )}
                  </div>
                  <span
                    className={`ml-2 px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                      item.type === "JOURNEY"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                    aria-label={`Item type: ${item.type === "JOURNEY" ? "Journey" : "Route"}`}
                  >
                    {item.type === "JOURNEY" ? "Journey" : "Route"}
                  </span>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                  <Calendar className="w-3 h-3" aria-hidden="true" />
                  <time dateTime={new Date(item.createdAt).toISOString()}>
                    Saved {new Date(item.createdAt).toLocaleDateString()}
                  </time>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {item.type === "JOURNEY" && (
                    <button
                      onClick={async () => {
                        const destination = getJourneyDestinationName(item.itineraryData?.legs ?? []);
                        const etaMinutes = formatDurationMinutes(item.totalDuration ?? 0);
                        const shareUrl = `${window.location.origin}/journey/${item.id}`;
                        const message = `View my Journey on Lokal! ETA to ${destination} is ${etaMinutes}. ${shareUrl}`;

                        try {
                          if (navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(message);
                          } else {
                            throw new Error("Clipboard API unavailable");
                          }
                          setCopiedJourneyId(item.id);
                          setTimeout(() => setCopiedJourneyId((current) => (current === item.id ? null : current)), 2000);
                        } catch (error) {
                          console.error("Failed to copy journey share link", error);
                          alert("Unable to copy share link. Please copy it manually: " + shareUrl);
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                    >
                      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {copiedJourneyId === item.id ? "Copied!" : "Share"}
                    </button>
                  )}
                  <button
                    onClick={() => onViewOnMap(item.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                  >
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    View on Map
                  </button>
                  {deleteConfirm === item.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onDelete(item.id)}
                        className="px-2 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => onDeleteConfirm(null)}
                        className="px-2 py-1.5 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors text-xs font-medium focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onDeleteConfirm(item.id)}
                      aria-label={`Delete ${item.nickname ?? "item"}`}
                      className="px-2 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JourneyDetails({ journey }: { journey: { type: "JOURNEY"; itineraryData: { legs: Array<{ type: string }>; routeName?: string; routeNumber?: string }; totalDistance: number; totalDuration: number } }) {
  const walkLegs = journey.itineraryData.legs.filter((leg) => leg.type === "walk");
  const busLegs = journey.itineraryData.legs.filter((leg) => leg.type === "bus");

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {journey.itineraryData.routeName && (
        <div className="flex items-center gap-1">
          <Bus className="w-3 h-3" aria-hidden="true" />
          <span className="font-medium">
            {journey.itineraryData.routeNumber}: {journey.itineraryData.routeName}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1">
          <Navigation className="w-3 h-3" aria-hidden="true" />
          {(journey.totalDistance / 1000).toFixed(1)} km
        </span>
        <span aria-hidden="true">•</span>
        <span>{journey.totalDuration} min</span>
      </div>
      <div className="flex gap-2">
        <span>{journey.itineraryData.legs.length} legs</span>
        {walkLegs.length > 0 && <span>• {walkLegs.length} walk</span>}
        {busLegs.length > 0 && <span>• {busLegs.length} bus</span>}
      </div>
    </div>
  );
}

function RouteDetails({ route }: { route: { type: "ROUTE"; routeId: string } }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Bus className="w-3 h-3" aria-hidden="true" />
        <span>Bus Line</span>
      </div>
      <div className="text-xs">Route ID: {route.routeId}</div>
    </div>
  );
}

function getJourneyDestinationName(legs: Array<{ endStopName?: string | null; end?: { stopName?: string | null } | null }>) {
  if (!legs.length) {
    return "my destination";
  }

  const lastLeg = legs[legs.length - 1];
  return lastLeg?.endStopName ?? lastLeg?.end?.stopName ?? "my destination";
}

function formatDurationMinutes(duration: number) {
  const rounded = Math.max(1, Math.round(duration));
  return `${rounded} minute${rounded === 1 ? "" : "s"}`;
}
