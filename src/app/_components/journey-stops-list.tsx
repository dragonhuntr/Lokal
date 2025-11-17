"use client";

import { useState } from "react";
import { GripVertical, X, AlertTriangle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import type { LocationSearchResult } from "./routes-sidebar";
import type { PlanItinerary } from "@/server/routing/service";
import { calculateItineraryTimes } from "./utils/itinerary-times";
import { formatDuration } from "@/utils/format";

import { Spinner } from "@/components/ui/spinner";

function getStopLetter(index: number): string {
  return String.fromCharCode(65 + index); // A, B, C, etc.
}

// Calculate segment duration between two stops from itinerary
function getSegmentDuration(
  fromIndex: number,
  toIndex: number,
  itinerary: PlanItinerary | null,
  totalStops: number
): number | null {
  if (!itinerary || fromIndex >= totalStops - 1 || toIndex !== fromIndex + 1) {
    return null;
  }
  
  // For multi-stop journeys, we need to calculate cumulative times
  // This is a simplified version - in reality, we'd need to track which legs belong to which segment
  // For now, we'll divide total duration by number of segments
  if (totalStops > 1) {
    return Math.round(itinerary.totalDurationMinutes / (totalStops - 1));
  }
  
  return itinerary.totalDurationMinutes;
}

interface SortableStopItemProps {
  stop: LocationSearchResult;
  index: number;
  totalStops: number;
  isFinal: boolean;
  segmentDuration: number | null;
  onRemove?: (id: string) => void;
  onUpdateStop?: (id: string, updates: Partial<LocationSearchResult>) => void;
  compact?: boolean;
}

function SortableStopItem({
  stop,
  index,
  totalStops,
  isFinal,
  segmentDuration,
  onRemove,
  onUpdateStop,
  compact = false,
}: SortableStopItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [bufferHours, setBufferHours] = useState(Math.floor((stop.bufferMinutes ?? 0) / 60));
  const [bufferMinutes, setBufferMinutes] = useState((stop.bufferMinutes ?? 0) % 60);
  const [purpose, setPurpose] = useState(stop.purpose ?? "");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveBuffer = () => {
    const totalMinutes = bufferHours * 60 + bufferMinutes;
    if (onUpdateStop) {
      onUpdateStop(stop.id, {
        bufferMinutes: totalMinutes,
        purpose: purpose.trim() || undefined,
      });
    }
    setIsExpanded(false);
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={isDragging ? "z-50 shadow-lg" : ""}
    >
      <div
        className={`rounded-lg border transition-shadow ${
          isFinal
            ? "border-blue-500 bg-blue-50 shadow-sm"
            : "border-border bg-card"
        } ${isDragging ? "shadow-lg ring-2 ring-blue-500/20" : ""}`}
      >
        <div className={`flex items-center justify-between px-3 py-2 ${compact ? "px-2 py-1.5" : ""}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="flex h-6 w-6 flex-shrink-0 cursor-grab items-center justify-center rounded-full bg-blue-100 text-blue-700 transition-colors active:cursor-grabbing hover:bg-blue-200"
              aria-label={`Drag to reorder ${stop.name}`}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>

            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {getStopLetter(index)}
            </div>

            <div className="min-w-0 flex-1">
              <div className={`truncate ${compact ? "text-xs" : "text-sm"} font-medium text-foreground`}>
                {stop.name}
              </div>
              {!compact && stop.placeName && stop.placeName !== stop.name && (
                <div className="truncate text-xs text-muted-foreground">
                  {stop.placeName}
                </div>
              )}
              {!compact && stop.bufferMinutes && stop.bufferMinutes > 0 && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(stop.bufferMinutes)} buffer</span>
                  {stop.purpose && <span className="text-muted-foreground">• {stop.purpose}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!compact && !isFinal && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`${isExpanded ? "Hide" : "Add"} buffer time`}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </button>
            )}
            {onRemove && (
              <button
                onClick={() => onRemove(stop.id)}
                className="flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${stop.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Buffer Time Configuration */}
        {!compact && isExpanded && !isFinal && (
          <div className="border-t border-border bg-muted/30 px-3 py-3">
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Time to spend here
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={bufferHours}
                      onChange={(e) => setBufferHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                      className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
                      placeholder="0"
                    />
                    <div className="mt-0.5 text-xs text-muted-foreground">Hours</div>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="15"
                      value={bufferMinutes}
                      onChange={(e) => setBufferMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
                      placeholder="0"
                    />
                    <div className="mt-0.5 text-xs text-muted-foreground">Minutes</div>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  {[15, 30, 60, 120, 240].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => {
                        setBufferHours(Math.floor(mins / 60));
                        setBufferMinutes(mins % 60);
                      }}
                      className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-200"
                    >
                      {formatDuration(mins)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Activity (optional)
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Shopping, Appointment, Lunch"
                  maxLength={200}
                  className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveBuffer}
                  className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="rounded border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {!compact && index < totalStops - 1 && (
        <div className="mt-2 flex items-center justify-center">
          <div className="flex h-8 w-0.5 bg-gradient-to-b from-blue-300 to-blue-100" />
        </div>
      )}
    </motion.div>
  );
}

interface JourneyStopsListProps {
  journeyStops: LocationSearchResult[];
  finalStopId: string | null;
  planStatus: "idle" | "loading" | "success" | "error";
  planItineraries?: PlanItinerary[] | null;
  planError?: string | null;
  onRemoveStop?: (id: string) => void;
  onReorderStops?: (stops: LocationSearchResult[]) => void;
  onUpdateStop?: (id: string, updates: Partial<LocationSearchResult>) => void;
  compact?: boolean;
}

export function JourneyStopsList({
  journeyStops,
  finalStopId,
  planStatus,
  planItineraries,
  planError,
  onRemoveStop,
  onReorderStops,
  onUpdateStop,
  compact = false,
}: JourneyStopsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (journeyStops.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${compact ? "mb-2" : "mb-3"}`}>
      <div className="flex items-center justify-between">
        <div className={`${compact ? "text-xs" : "text-xs"} font-medium text-muted-foreground`}>
          Journey Stops ({journeyStops.length})
        </div>
        {journeyStops.length >= 5 && !compact && (
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            <span>Many stops may slow planning</span>
          </div>
        )}
      </div>
      
      {planStatus === "loading" && !compact && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <Spinner size="sm" className="text-blue-600" />
          <span>Calculating route...</span>
        </div>
      )}
      
      {planError && !compact && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{planError}</span>
          </div>
        </div>
      )}
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event: DragEndEvent) => {
          const { active, over } = event;
          if (over && active.id !== over.id && onReorderStops) {
            const oldIndex = journeyStops.findIndex((stop) => stop.id === active.id);
            const newIndex = journeyStops.findIndex((stop) => stop.id === over.id);
            const newStops = arrayMove(journeyStops, oldIndex, newIndex);
            onReorderStops(newStops);
          }
        }}
      >
        <SortableContext
          items={journeyStops.map((stop) => stop.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence mode="popLayout">
            <div className="space-y-1.5">
              {journeyStops.map((stop, index) => {
                const isFinal = stop.id === finalStopId;
                const bestItinerary = planItineraries?.[0] ?? null;
                const segmentDuration = getSegmentDuration(
                  index,
                  index + 1,
                  bestItinerary,
                  journeyStops.length
                );
                
                return (
                  <SortableStopItem
                    key={stop.id}
                    stop={stop}
                    index={index}
                    totalStops={journeyStops.length}
                    isFinal={isFinal}
                    segmentDuration={segmentDuration}
                    onRemove={onRemoveStop}
                    onUpdateStop={onUpdateStop}
                    compact={compact}
                  />
                );
              })}
            </div>
          </AnimatePresence>
        </SortableContext>
      </DndContext>
      
      {planItineraries && planItineraries.length > 0 && planStatus === "success" && planItineraries[0] && !compact && (
        <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-green-900">Total duration:</span>
            <span className="text-green-700">
              {formatDuration(calculateItineraryTimes(planItineraries[0]).displayedDurationMinutes)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

