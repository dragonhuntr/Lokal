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
 * Gets the next available departure for a specific stop and route
 */
export async function getNextDeparture(
  stopId: string,
  routeId: string,
  requestedDepartureTime: Date
): Promise<NextDepartureInfo | null> {
  try {
    // Convert stopId to number if it's a string
    const stopIdNum = typeof stopId === "string" ? parseInt(stopId, 10) : stopId;
    if (isNaN(stopIdNum)) {
      console.warn(`Invalid stopId: ${stopId}`);
      return null;
    }

    // Fetch all stop departures
    const allDepartures = await fetchStopDepartures(stopIdNum);
    const stopInfo = allDepartures.find((sd) => sd.StopId === stopIdNum);

    if (!stopInfo) {
      return null;
    }

    // Find the route direction matching the routeId
    const routeDirection = stopInfo.RouteDirections.find(
      (rd) => rd.RouteId === routeId || rd.RouteRecordId.toString() === routeId
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

    // For future times, prefer scheduled times (SDT)
    // For current/immediate trips, prefer real-time estimates (EDT)
    const relevantDepartures = departures
      .map((dep) => {
        if (isFuture) {
          // Use scheduled time for future planning
          const scheduledTime = dep.SDT ? parseApiDate(dep.SDT) : null;
          const scheduledLocalTime = dep.SDTLocalTime ? parseApiDate(dep.SDTLocalTime) : null;
          const departureTime = scheduledLocalTime ?? scheduledTime;
          
          if (departureTime && departureTime.getTime() >= requestedTime) {
            const arrivalTime = dep.STA ? parseApiDate(dep.STA) : (dep.STALocalTime ? parseApiDate(dep.STALocalTime) : null);
            return {
              departureTime,
              arrivalTime,
              dataSource: "scheduled" as DataSource,
              tripId: dep.Trip?.TripId,
            };
          }
        } else {
          // Use real-time estimate for current/immediate trips
          const estimatedTime = dep.EDTLocalTime ? parseApiDate(dep.EDTLocalTime) : (dep.EDT ? parseApiDate(dep.EDT) : null);
          const scheduledTime = dep.SDTLocalTime ? parseApiDate(dep.SDTLocalTime) : (dep.SDT ? parseApiDate(dep.SDT) : null);
          const departureTime = estimatedTime ?? scheduledTime;
          
          if (departureTime && departureTime.getTime() >= requestedTime) {
            const arrivalTime = dep.ETALocalTime ? parseApiDate(dep.ETALocalTime) : (dep.ETA ? parseApiDate(dep.ETA) : null);
            return {
              departureTime,
              arrivalTime,
              dataSource: estimatedTime ? "realtime" : "scheduled" as DataSource,
              tripId: dep.Trip?.TripId,
            };
          }
        }
        return null;
      })
      .filter((dep): dep is NonNullable<typeof dep> => dep !== null)
      .sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());

    if (relevantDepartures.length === 0) {
      return null;
    }

    const next = relevantDepartures[0];
    const waitTimeMs = next.departureTime.getTime() - requestedTime;

    return {
      departureTime: next.departureTime,
      arrivalTime: next.arrivalTime,
      waitTimeMinutes: Math.max(0, waitTimeMs / (60 * 1000)),
      dataSource: next.dataSource,
      tripId: next.tripId,
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

