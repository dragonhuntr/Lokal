/**
 * Real-time Data Source - Provides live bus data from Availtec API
 */

import { fetchStopDepartures } from "@/server/bus-api";
import { generateFakeDepartures, shouldUseFakeBuses } from "@/server/dev-bus-data";
import type { DepartureDataSource, DepartureInfo } from "./base";
import { DataSourceType } from "./base";

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
 * Real-time Data Source implementation
 * Provides live departure data from Availtec InfoPoint API
 */
export class RealtimeDataSource implements DepartureDataSource {
  async getNextDeparture(
    stopId: number,
    routeId: number,
    requestedDepartureTime: Date
  ): Promise<DepartureInfo | null> {
    try {
      // In dev mode, generate fake departures if enabled
      let allDepartures = await fetchStopDepartures(stopId);

      // If API returns no data and we're in dev mode, use fake departures
      if (allDepartures.length === 0 && shouldUseFakeBuses()) {
        const fakeDeparture = generateFakeDepartures(stopId, routeId);
        if (fakeDeparture) {
          console.log(`[DEV MODE] Using fake departures for route planning: stop ${stopId}, route ${routeId}`);
          allDepartures = [fakeDeparture];
        }
      }

      const stopInfo = allDepartures.find((sd) => sd.StopId === stopId);

      // No stop info from API
      if (!stopInfo) {
        return null;
      }

      // Find the route direction matching the routeId
      const routeDirection = stopInfo.RouteDirections.find((rd) => {
        const rdRouteId = parseInt(rd.RouteId, 10);
        return (
          (!isNaN(rdRouteId) && rdRouteId === routeId) ||
          rd.RouteId === routeId.toString() ||
          rd.RouteRecordId === routeId ||
          rd.RouteRecordId.toString() === routeId.toString()
        );
      });

      // No route direction found
      if (!routeDirection) {
        return null;
      }

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
              dataSource: DataSourceType.REALTIME,
              tripId: headway.VehicleId,
            };
          }
        }
      }

      // Handle scheduled departures
      const departures = routeDirection.Departures.filter(
        (dep) => !dep.IsCompleted
      );

      if (departures.length === 0) {
        return null;
      }

      // Process all scheduled departures
      // Always prefer real-time data (EDT) when available, fallback to scheduled (SDT)
      const allScheduledDepartures = departures
        .map((dep) => {
          // Prefer real-time estimate (EDT) when available, fallback to scheduled (SDT)
          const estimatedTime = dep.EDTLocalTime
            ? parseApiDate(dep.EDTLocalTime)
            : dep.EDT
              ? parseApiDate(dep.EDT)
              : null;
          const scheduledTime = dep.SDTLocalTime
            ? parseApiDate(dep.SDTLocalTime)
            : dep.SDT
              ? parseApiDate(dep.SDT)
              : null;
          const departureTime = estimatedTime ?? scheduledTime;

          if (departureTime) {
            // Prefer real-time arrival (ETA) when available, fallback to scheduled (STA)
            const estimatedArrival = dep.ETALocalTime
              ? parseApiDate(dep.ETALocalTime)
              : dep.ETA
                ? parseApiDate(dep.ETA)
                : null;
            const scheduledArrival = dep.STALocalTime
              ? parseApiDate(dep.STALocalTime)
              : dep.STA
                ? parseApiDate(dep.STA)
                : null;
            const arrivalTime = estimatedArrival ?? scheduledArrival;

            return {
              departureTime,
              arrivalTime,
              dataSource: estimatedTime
                ? DataSourceType.REALTIME
                : DataSourceType.SCHEDULED,
              tripId: dep.Trip?.TripId?.toString(),
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
      const nextDeparture = allScheduledDepartures.find(
        (dep) => dep.departureTime.getTime() >= requestedTime
      );

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
      console.error(
        `[RealtimeDataSource] Error fetching real-time data for stop ${stopId}, route ${routeId}:`,
        error
      );
      return null;
    }
  }
}
