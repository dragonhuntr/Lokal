"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, MapPin, Trash2, Calendar, Navigation, Bus } from "lucide-react";
import { useSavedItems } from "@/trpc/saved-items";
import { useSession } from "@/trpc/session";
import { useRouter } from "next/navigation";

interface SavedItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavedItemsDialog({ open, onOpenChange }: SavedItemsDialogProps) {
  const { user } = useSession();
  const { items, journeys, routes, remove } = useSavedItems();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "journeys" | "routes">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredItems = filter === "all"
    ? items
    : filter === "journeys"
    ? journeys
    : routes;

  const handleViewOnMap = (itemId: string) => {
    onOpenChange(false);
    router.push(`/?itemId=${itemId}`);
  };

  const handleDelete = async (itemId: string) => {
    await remove(itemId);
    setDeleteConfirm(null);
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-[90vw] max-w-3xl max-h-[85vh] overflow-hidden z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <Dialog.Title className="text-2xl font-bold text-gray-900">
              My Saved Items
            </Dialog.Title>
            <Dialog.Close className="rounded-full p-2 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 px-6 pt-4 border-b">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 font-medium transition-colors rounded-t-lg ${
                filter === "all"
                  ? "text-blue-600 bg-blue-50 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter("journeys")}
              className={`px-4 py-2 font-medium transition-colors rounded-t-lg ${
                filter === "journeys"
                  ? "text-blue-600 bg-blue-50 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Journeys ({journeys.length})
            </button>
            <button
              onClick={() => setFilter("routes")}
              className={`px-4 py-2 font-medium transition-colors rounded-t-lg ${
                filter === "routes"
                  ? "text-blue-600 bg-blue-50 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Routes ({routes.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <MapPin className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No saved items yet
                </h3>
                <p className="text-gray-600 max-w-sm">
                  Start planning journeys and saving your favorite routes to see them here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover:shadow-lg transition-shadow bg-white"
                  >
                    {/* Item Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {item.nickname ?? "Untitled"}
                        </h3>
                        {item.type === "JOURNEY" ? (
                          <JourneyDetails journey={item} />
                        ) : (
                          <RouteDetails route={item} />
                        )}
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          item.type === "JOURNEY"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {item.type === "JOURNEY" ? "Journey" : "Route"}
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                      <Calendar className="w-3 h-3" />
                      <span>
                        Saved {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewOnMap(item.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <MapPin className="w-4 h-4" />
                        View on Map
                      </button>
                      {deleteConfirm === item.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function JourneyDetails({ journey }: { journey: { type: "JOURNEY"; itineraryData: { legs: Array<{ type: string }>; routeName?: string; routeNumber?: string }; totalDistance: number; totalDuration: number } }) {
  const walkLegs = journey.itineraryData.legs.filter((leg) => leg.type === "walk");
  const busLegs = journey.itineraryData.legs.filter((leg) => leg.type === "bus");

  return (
    <div className="space-y-1 text-sm text-gray-600">
      {journey.itineraryData.routeName && (
        <div className="flex items-center gap-1">
          <Bus className="w-3 h-3" />
          <span className="font-medium">
            {journey.itineraryData.routeNumber}: {journey.itineraryData.routeName}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1">
          <Navigation className="w-3 h-3" />
          {(journey.totalDistance / 1000).toFixed(1)} km
        </span>
        <span>•</span>
        <span>{journey.totalDuration} min</span>
      </div>
      <div className="flex gap-2 text-xs">
        <span>{journey.itineraryData.legs.length} legs</span>
        {walkLegs.length > 0 && <span>• {walkLegs.length} walk</span>}
        {busLegs.length > 0 && <span>• {busLegs.length} bus</span>}
      </div>
    </div>
  );
}

function RouteDetails({ route }: { route: { type: "ROUTE"; routeId: string } }) {
  return (
    <div className="space-y-1 text-sm text-gray-600">
      <div className="flex items-center gap-1">
        <Bus className="w-3 h-3" />
        <span>Bus Line</span>
      </div>
      <div className="text-xs text-gray-500">Route ID: {route.routeId}</div>
    </div>
  );
}
