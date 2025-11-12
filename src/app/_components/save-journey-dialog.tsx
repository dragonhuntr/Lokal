"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Bookmark, Navigation, Bus } from "lucide-react";
import { useSavedItems } from "@/trpc/saved-items";
import { type PlanItinerary } from "@/server/routing/service";

interface SaveJourneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itinerary: PlanItinerary | null;
  originLat: number | null;
  originLng: number | null;
  defaultNickname?: string;
}

export function SaveJourneyDialog({
  open,
  onOpenChange,
  itinerary,
  originLat,
  originLng,
  defaultNickname,
}: SaveJourneyDialogProps) {
  const { saveJourney } = useSavedItems();
  const [nickname, setNickname] = useState(defaultNickname ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Sync nickname with defaultNickname when it changes
  useEffect(() => {
    setNickname(defaultNickname ?? "");
  }, [defaultNickname]);

  const handleSave = async () => {
    if (!itinerary || originLat === null || originLng === null) return;

    setIsSaving(true);
    try {
      await saveJourney(
        itinerary,
        originLat,
        originLng,
        nickname.trim() || undefined
      );
      onOpenChange(false);
      setNickname(defaultNickname ?? "");
    } catch (error) {
      console.error("Failed to save journey:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!itinerary) return null;

  const walkLegs = itinerary.legs.filter((leg) => leg.type === "walk");
  const busLegs = itinerary.legs.filter((leg) => leg.type === "bus");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-[90vw] max-w-md z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bookmark className="w-5 h-5 text-blue-600" />
              </div>
              <Dialog.Title className="text-xl font-bold text-gray-900">
                Save Journey
              </Dialog.Title>
            </div>
            <Dialog.Close className="rounded-full p-2 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Journey Preview */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">Journey Details</h3>

              {itinerary.routeName && (
                <div className="flex items-center gap-2 text-sm">
                  <Bus className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">
                    {itinerary.routeNumber}: {itinerary.routeName}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Navigation className="w-4 h-4" />
                  <span>{(itinerary.totalDistanceMeters / 1000).toFixed(1)} km</span>
                </div>
                <span>•</span>
                <span>{itinerary.totalDurationMinutes} min</span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="px-2 py-1 bg-white rounded">
                  {itinerary.legs.length} legs
                </span>
                {walkLegs.length > 0 && (
                  <span className="px-2 py-1 bg-white rounded">
                    {walkLegs.length} walk
                  </span>
                )}
                {busLegs.length > 0 && (
                  <span className="px-2 py-1 bg-white rounded">
                    {busLegs.length} bus
                  </span>
                )}
              </div>
            </div>

            {/* Nickname Input */}
            <div className="space-y-2">
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-900">
                Nickname (Optional)
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g., Home to Office, Weekend Trip"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                maxLength={100}
              />
              <p className="text-xs text-gray-500">
                Give this journey a memorable name to find it easily later
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSave}
                disabled={isSaving || originLat === null || originLng === null}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" />
                    Save Journey
                  </>
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
