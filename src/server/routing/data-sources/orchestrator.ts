/**
 * Departure Orchestrator - Manages fallback strategy between data sources
 * Strategy: Real-time API → GTFS Static Data → null
 */

import type { DepartureDataSource, DepartureInfo } from "./base";
import { FallbackReason } from "./base";
import { RealtimeDataSource } from "./realtime";
import { GTFSDataSource } from "./gtfs";

/**
 * Checks if a date is on a different day than today
 */
function isDifferentDay(date: Date): boolean {
  const now = new Date();
  const dateStr = date.toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];
  return dateStr !== nowStr;
}

/**
 * Converts route ID to number (handles both numeric strings and formatted strings)
 */
function parseRouteId(routeId: string | number): number | null {
  if (typeof routeId === "number") {
    return routeId;
  }

  // Try parsing as direct number first
  const numericId = parseInt(routeId, 10);
  if (!isNaN(numericId)) {
    return numericId;
  }

  // Fallback: parse formatted string (backward compatibility)
  const match = routeId.match(/^route-(\d+)$/);
  if (match?.[1]) {
    const parsed = parseInt(match[1], 10);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Converts stop ID to number (handles both numeric strings and formatted strings)
 */
function parseStopId(stopId: string | number): number | null {
  if (typeof stopId === "number") {
    return stopId;
  }

  // Try parsing as direct number first
  const numericId = parseInt(stopId, 10);
  if (!isNaN(numericId)) {
    return numericId;
  }

  // Fallback: parse formatted string (backward compatibility)
  const match = stopId.match(/^stop-\d+-(\d+)-\d+$/);
  if (match?.[1]) {
    const parsed = parseInt(match[1], 10);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Orchestrator for managing departure data sources with fallback logic
 *
 * Priority order:
 * 1. Real-time API (Availtec) - when buses are active
 * 2. GTFS static data - when API returns empty, no active buses, or scheduling future trips
 * 3. Return null - when both sources have no data
 */
export class DepartureOrchestrator {
  private realtimeSource: DepartureDataSource;
  private gtfsSource: DepartureDataSource;

  constructor(
    realtimeSource?: DepartureDataSource,
    gtfsSource?: DepartureDataSource
  ) {
    this.realtimeSource = realtimeSource ?? new RealtimeDataSource();
    this.gtfsSource = gtfsSource ?? new GTFSDataSource();
  }

  /**
   * Gets the next available departure with automatic fallback
   *
   * @param stopId Stop ID (string or number)
   * @param routeId Route ID (string or number)
   * @param requestedDepartureTime Requested departure time
   * @returns Departure info or null if no departures available from any source
   */
  async getNextDeparture(
    stopId: string | number,
    routeId: string | number,
    requestedDepartureTime: Date
  ): Promise<DepartureInfo | null> {
    // Parse numeric IDs
    const stopIdNum = parseStopId(stopId);
    const routeIdNum = parseRouteId(routeId);

    if (!stopIdNum) {
      console.warn(
        `[DepartureOrchestrator] Invalid stopId format: ${stopId}`
      );
      return null;
    }

    if (!routeIdNum) {
      console.warn(
        `[DepartureOrchestrator] Invalid routeId format: ${routeId}`
      );
      return null;
    }

    // Determine if this is a future trip (different day)
    const isFutureTrip = isDifferentDay(requestedDepartureTime);

    // Try real-time API first
    let realtimeDeparture: DepartureInfo | null = null;
    let fallbackReason: FallbackReason | null = null;

    try {
      realtimeDeparture = await this.realtimeSource.getNextDeparture(
        stopIdNum,
        routeIdNum,
        requestedDepartureTime
      );

      if (realtimeDeparture) {
        return realtimeDeparture;
      } else {
        // Real-time returned null - determine why
        if (isFutureTrip) {
          fallbackReason = FallbackReason.FUTURE_TIME;
        } else {
          fallbackReason = FallbackReason.NO_ACTIVE_BUSES;
        }
      }
    } catch (error) {
      fallbackReason = FallbackReason.ERROR;
      console.warn(
        `[DepartureOrchestrator] → Real-time API error for stop ${stopId}, route ${routeId}, trying GTFS:`,
        error
      );
    }

    // Fallback to GTFS
    try {
      const gtfsDeparture = await this.gtfsSource.getNextDeparture(
        stopIdNum,
        routeIdNum,
        requestedDepartureTime
      );

      if (gtfsDeparture) {
        return gtfsDeparture;
      } else {
        return null;
      }
    } catch (error) {
      console.error(
        `[DepartureOrchestrator] ✗ GTFS error for stop ${stopId}, route ${routeId}:`,
        error
      );
      return null;
    }
  }
}

// Export singleton instance for convenience
export const departureOrchestrator = new DepartureOrchestrator();
