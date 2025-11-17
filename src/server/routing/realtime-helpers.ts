"use strict";

import { fetchStopDepartures } from "@/server/bus-api";
import type { StopDeparture, RouteDirection } from "@/server/bus-api";

export type DataSource = "realtime" | "scheduled" | "estimated";

export interface NextDepartureInfo {
  departureTime: Date;
  arrivalTime: Date | null;
  waitTimeMinutes: number;
  dataSource: DataSource;
  tripId?: string;
}

const FUTURE_TIME_BUFFER_MINUTES = 5; // Consider times beyond 5 minutes as "future"

/**
 * Determines if a departure time is considered "future" (beyond current time + buffer)
 */
export function isFutureTime(departureTime: Date): boolean {
  const now = new Date();
  const bufferMs = FUTURE_TIME_BUFFER_MINUTES * 60 * 1000;
  return departureTime.getTime() > now.getTime() + bufferMs;
}

/**
 * Parses a date string from the API (can be ISO string or local time string)
 */
function parseApiDate(dateString: string): Date {
  // Try parsing as ISO first
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Fallback: try parsing as local time
  return new Date(dateString);
}

/**
 * Converts route ID to number (handles both numeric strings and formatted strings for backward compatibility)
 */
function parseRouteId(routeId: string | number): number | null {
  if (typeof routeId === "number") {
    return routeId;
  }
  
  // Try parsing as direct number first (preferred - should be numeric ID from DB)
  const numericId = parseInt(routeId, 10);
  if (!isNaN(numericId)) {
    return numericId;
  }
  
  // Fallback: parse formatted string (for backward compatibility)
  const match = routeId.match(/^route-(\d+)$/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

/**
 * Converts stop ID to number (handles both numeric strings and formatted strings for backward compatibility)
 */
function parseStopId(stopId: string | number): number | null {
  if (typeof stopId === "number") {
    return stopId;
  }
  
  // Try parsing as direct number first (preferred - should be numeric ID from DB)
  const numericId = parseInt(stopId, 10);
  if (!isNaN(numericId)) {
    return numericId;
  }
  
  // Fallback: parse formatted string (for backward compatibility)
  const match = stopId.match(/^stop-\d+-(\d+)-\d+$/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

/**
 * Gets the next available departure for a specific stop and route
 */
export async function getNextDeparture(
  stopId: string,
  routeId: string,
  requestedDepartureTime: Date
): Promise<NextDepartureInfo | null> {
  try {
    // Parse numeric IDs (prefers direct numeric IDs from DB, falls back to parsing formatted strings)
    const stopIdNum = parseStopId(stopId);
    const routeIdNum = parseRouteId(routeId);
    
    if (!stopIdNum) {
      console.warn(`Invalid stopId format: ${stopId}`);
      return null;
    }
    
    if (!routeIdNum) {
      console.warn(`Invalid routeId format: ${routeId}`);
      return null;
    }

    // Fetch all stop departures
    const allDepartures = await fetchStopDepartures(stopIdNum);
    const stopInfo = allDepartures.find((sd) => sd.StopId === stopIdNum);

    if (!stopInfo) {
      return null;
    }

    // Find the route direction matching the routeId (compare as numbers or strings)
    const routeDirection = stopInfo.RouteDirections.find(
      (rd) => {
        const rdRouteId = parseInt(rd.RouteId, 10);
        return (!isNaN(rdRouteId) && rdRouteId === routeIdNum) || 
               rd.RouteId === routeId || 
               rd.RouteRecordId === routeIdNum ||
               rd.RouteRecordId.toString() === routeId;
      }
    );

    if (!routeDirection) {
      return null;
    }

    const isFuture = isFutureTime(requestedDepartureTime);
    const requestedTime = requestedDepartureTime.getTime();

    // Handle headway-based routes (frequency-based service)
    if (routeDirection.IsHeadway && routeDirection.HeadwayDepartures) {
      const headway = routeDirection.HeadwayDepartures[0];
      if (headway?.NextDeparture) {
        const nextDepartureTime = parseApiDate(headway.NextDeparture);
        if (nextDepartureTime.getTime() >= requestedTime) {
          const waitTimeMs = nextDepartureTime.getTime() - requestedTime;
          return {
            departureTime: nextDepartureTime,
            arrivalTime: null,
            waitTimeMinutes: Math.max(0, waitTimeMs / (60 * 1000)),
            dataSource: isFuture ? "scheduled" : "realtime",
            tripId: headway.VehicleId,
          };
        }
      }
    }

    // Handle scheduled departures
    const departures = routeDirection.Departures.filter((dep) => !dep.IsCompleted);
    
    if (departures.length === 0) {
      return null;
    }

    // Check ALL scheduled departures regardless of time to find the next available bus
    // This allows us to find buses that may be days away when no buses are running now
    // Always prefer real-time data (EDT) when available, fallback to scheduled (SDT)
    const allScheduledDepartures = departures
      .map((dep) => {
        // Always prefer real-time estimate (EDT) when available, fallback to scheduled (SDT)
        const estimatedTime = dep.EDTLocalTime ? parseApiDate(dep.EDTLocalTime) : (dep.EDT ? parseApiDate(dep.EDT) : null);
        const scheduledTime = dep.SDTLocalTime ? parseApiDate(dep.SDTLocalTime) : (dep.SDT ? parseApiDate(dep.SDT) : null);
        const departureTime = estimatedTime ?? scheduledTime;
        
        if (departureTime) {
          // Prefer real-time arrival (ETA) when available, fallback to scheduled (STA)
          const estimatedArrival = dep.ETALocalTime ? parseApiDate(dep.ETALocalTime) : (dep.ETA ? parseApiDate(dep.ETA) : null);
          const scheduledArrival = dep.STALocalTime ? parseApiDate(dep.STALocalTime) : (dep.STA ? parseApiDate(dep.STA) : null);
          const arrivalTime = estimatedArrival ?? scheduledArrival;
          
          return {
            departureTime,
            arrivalTime,
            dataSource: estimatedTime ? "realtime" : "scheduled" as DataSource,
            tripId: dep.Trip?.TripId,
          };
        }
        return null;
      })
      .filter((dep): dep is NonNullable<typeof dep> => dep !== null)
      .sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());

    if (allScheduledDepartures.length === 0) {
      return null;
    }

    // Find the next departure that is >= requestedTime
    // This allows us to find buses even if they're days away when no buses are running now
    const nextDeparture = allScheduledDepartures.find(
      (dep) => dep.departureTime.getTime() >= requestedTime
    );

    // If no departure >= requestedTime exists, return null (no buses available)
    if (!nextDeparture) {
      return null;
    }

    const waitTimeMs = nextDeparture.departureTime.getTime() - requestedTime;

    return {
      departureTime: nextDeparture.departureTime,
      arrivalTime: nextDeparture.arrivalTime,
      waitTimeMinutes: Math.max(0, waitTimeMs / (60 * 1000)),
      dataSource: nextDeparture.dataSource,
      tripId: nextDeparture.tripId,
    };
  } catch (error) {
    console.error(`Error fetching next departure for stop ${stopId}, route ${routeId}:`, error);
    return null;
  }
}

/**
 * Calculates bus travel time using real-time data if available
 */
export function calculateBusTravelTime(
  startStopId: string,
  endStopId: string,
  routeId: string,
  departureTime: Date,
  staticDurationMinutes: number
): { durationMinutes: number; dataSource: DataSource } {
  // For now, we'll use static calculation
  // In the future, we could fetch route details and calculate based on vehicle positions
  // This would require more complex logic to match trips and calculate segment times
  return {
    durationMinutes: staticDurationMinutes,
    dataSource: "estimated",
  };
}

