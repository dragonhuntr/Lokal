"use client";

import { GripVertical, X, AlertTriangle } from "lucide-react";
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

import { Spinner } from "@/components/ui/spinner";

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

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
  compact?: boolean;
}

function SortableStopItem({
  stop,
  index,
  totalStops,
  isFinal,
  segmentDuration,
  onRemove,
  compact = false,
}: SortableStopItemProps) {
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
        className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-shadow ${
          isFinal
            ? "border-blue-500 bg-blue-50 shadow-sm"
            : "border-border bg-card"
        } ${isDragging ? "shadow-lg ring-2 ring-blue-500/20" : ""} ${compact ? "px-2 py-1.5" : ""}`}
      >
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
          </div>
        </div>
        
        {onRemove && (
          <button
            onClick={() => onRemove(stop.id)}
            className="ml-2 flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Remove ${stop.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {!compact && segmentDuration !== null && index < totalStops - 1 && (
        <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span className="px-2">
            {formatDuration(segmentDuration)} to next stop
          </span>
          <div className="h-px flex-1 bg-border" />
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

