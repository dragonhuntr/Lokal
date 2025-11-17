import type { PlanItinerary, PlanStop } from "@/server/routing/service";

export interface ItineraryTimes {
  startTime: Date | null;
  arrivalTime: Date | null;
  displayedDurationMinutes: number;
}

export interface MultiStopJourneyTimes {
  startTime: Date | null;
  finalArrivalTime: Date | null;
  totalTravelMinutes: number; // Travel time excluding buffers
  totalBufferMinutes: number;
  totalDurationMinutes: number; // Travel + buffer time
  stops: PlanStop[];
}

/**
 * Calculates optimized start time, arrival time, and displayed duration for an itinerary.
 * Start time is optimized to eliminate wait time at bus stops.
 */
export function calculateItineraryTimes(itinerary: PlanItinerary): ItineraryTimes {
  // Find the first bus leg with a departure time to use as anchor
  const firstBusLegIndex = itinerary.legs.findIndex((leg) => leg.type === "bus" && leg.departureTime);
  
  if (firstBusLegIndex < 0) {
    // No bus leg with departure time - return null times
    return {
      startTime: null,
      arrivalTime: null,
      displayedDurationMinutes: itinerary.totalDurationMinutes,
    };
  }

  const firstBusLeg = itinerary.legs[firstBusLegIndex];
  if (!firstBusLeg?.departureTime) {
    return {
      startTime: null,
      arrivalTime: null,
      displayedDurationMinutes: itinerary.totalDurationMinutes,
    };
  }

  const busDepartureTime = new Date(firstBusLeg.departureTime);
  
  // Calculate backwards from bus departure to find journey start time
  // Sum up all walk durations before the bus leg
  let walkDurationBeforeBus = 0;
  for (let i = 0; i < firstBusLegIndex; i++) {
    const leg = itinerary.legs[i];
    if (leg) {
      walkDurationBeforeBus += leg.durationMinutes;
    }
  }
  
  // Start time = bus departure - walk duration
  // This ensures you arrive at the stop exactly when the bus is ready to depart (no wait time)
  const startTime = new Date(busDepartureTime.getTime() - walkDurationBeforeBus * 60 * 1000);
  
  // Calculate arrival time by summing all leg durations (excluding wait time)
  let currentTime = new Date(startTime);
  for (const leg of itinerary.legs) {
    if (leg.type === "bus" && leg.departureTime) {
      // For bus legs with departure time, use the departure time as start
      const busDeparture = new Date(leg.departureTime);
      currentTime = new Date(busDeparture.getTime() + leg.durationMinutes * 60 * 1000);
    } else {
      // For walk legs or bus legs without departure time, add duration
      currentTime = new Date(currentTime.getTime() + leg.durationMinutes * 60 * 1000);
    }
  }
  const arrivalTime = currentTime;
  
  // Calculate displayed duration from optimized start time to arrival time (excluding wait time)
  const displayedDurationMinutes = (arrivalTime.getTime() - startTime.getTime()) / (60 * 1000);

  return {
    startTime,
    arrivalTime,
    displayedDurationMinutes,
  };
}

/**
 * Calculates detailed timing information for multi-stop journeys with buffer times.
 * Returns arrival/departure times for each stop and total duration breakdown.
 */
export function calculateMultiStopJourneyTimes(itinerary: PlanItinerary): MultiStopJourneyTimes {
  // If the itinerary already has stops with times calculated by the backend, use those
  if (itinerary.stops && itinerary.stops.length > 0) {
    const totalBufferMinutes = itinerary.totalBufferMinutes ?? 0;
    const totalTravelMinutes = itinerary.totalDurationMinutes - totalBufferMinutes;

    return {
      startTime: itinerary.stops[0]?.departureTime ?? null,
      finalArrivalTime: itinerary.stops[itinerary.stops.length - 1]?.arrivalTime ?? null,
      totalTravelMinutes,
      totalBufferMinutes,
      totalDurationMinutes: itinerary.totalDurationMinutes,
      stops: itinerary.stops,
    };
  }

  // Fallback: calculate times from legs if stops aren't populated
  const basicTimes = calculateItineraryTimes(itinerary);

  return {
    startTime: basicTimes.startTime,
    finalArrivalTime: basicTimes.arrivalTime,
    totalTravelMinutes: itinerary.totalDurationMinutes,
    totalBufferMinutes: 0,
    totalDurationMinutes: itinerary.totalDurationMinutes,
    stops: [],
  };
}

