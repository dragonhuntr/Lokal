/**
 * Real-time helpers - Legacy compatibility layer
 *
 * @deprecated This file is kept for backward compatibility only.
 * New code should use the data-sources/orchestrator.ts instead.
 */

import { departureOrchestrator } from "./data-sources/orchestrator";
import type { DepartureInfo } from "./data-sources/base";

export type DataSource = "realtime" | "scheduled" | "estimated";

export interface NextDepartureInfo {
  departureTime: Date;
  arrivalTime: Date | null;
  waitTimeMinutes: number;
  dataSource: DataSource;
  tripId?: string;
}

/**
 * Gets the next available departure for a specific stop and route
 *
 * @deprecated Use departureOrchestrator.getNextDeparture() instead
 * This is a legacy compatibility wrapper.
 */
export async function getNextDeparture(
  stopId: string,
  routeId: string,
  requestedDepartureTime: Date
): Promise<NextDepartureInfo | null> {
  // Forward to orchestrator which handles real-time → GTFS fallback
  const result = await departureOrchestrator.getNextDeparture(
    stopId,
    routeId,
    requestedDepartureTime
  );

  if (!result) {
    return null;
  }

  // Convert DepartureInfo to NextDepartureInfo (same structure, just type compatibility)
  return {
    departureTime: result.departureTime,
    arrivalTime: result.arrivalTime,
    waitTimeMinutes: result.waitTimeMinutes,
    dataSource: result.dataSource as DataSource,
    tripId: result.tripId,
  };
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
