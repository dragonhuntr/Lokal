/**
 * GTFS Data Source - Provides static schedule data from the database
 */

import { getRouteDeparturesAtStop } from "@/server/gtfs-schedule";
import { parseGTFSTime } from "../../../../prisma/gtfs-parser";
import type { DepartureDataSource, DepartureInfo } from "./base";
import { DataSourceType } from "./base";

/**
 * Converts GTFS time string to a Date object
 * Handles GTFS times > 24 hours (e.g., "25:30:00" = next day 1:30 AM)
 * @param gtfsTime GTFS time string (e.g., "14:30:00" or "25:30:00")
 * @param baseDate Base date to apply the time to
 * @returns Date object with the GTFS time applied
 */
function gtfsTimeToDate(gtfsTime: string, baseDate: Date): Date {
  const { hours, minutes, seconds } = parseGTFSTime(gtfsTime);
  const date = new Date(baseDate);

  // Handle times >= 24 hours (next day)
  if (hours >= 24) {
    date.setUTCHours(hours - 24, minutes, seconds || 0, 0);
    date.setUTCDate(date.getUTCDate() + 1);
  } else {
    date.setUTCHours(hours, minutes, seconds || 0, 0);
  }

  return date;
}

/**
 * GTFS Data Source implementation
 * Provides scheduled departures from static GTFS data in the database
 */
export class GTFSDataSource implements DepartureDataSource {
  async getNextDeparture(
    stopId: number,
    routeId: number,
    requestedDepartureTime: Date
  ): Promise<DepartureInfo | null> {
    try {
      // Normalize date to midnight UTC for GTFS query
      const queryDate = new Date(requestedDepartureTime);
      queryDate.setUTCHours(0, 0, 0, 0);

      // Get scheduled departures from GTFS database
      const gtfsDepartures = await getRouteDeparturesAtStop(
        routeId,
        stopId,
        queryDate,
        50 // Get enough departures to find one >= requested time
      );

      if (gtfsDepartures.length === 0) {
        return null;
      }

      const requestedTime = requestedDepartureTime.getTime();

      // Convert GTFS time strings to Date objects
      const departuresWithDates = gtfsDepartures
        .map((dep) => {
          const departureDate = gtfsTimeToDate(dep.departureTime, queryDate);
          const arrivalDate = dep.arrivalTime
            ? gtfsTimeToDate(dep.arrivalTime, queryDate)
            : null;

          return {
            departureTime: departureDate,
            arrivalTime: arrivalDate,
            tripId: dep.tripId,
          };
        })
        .filter((dep) => dep.departureTime.getTime() >= requestedTime)
        .sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());

      if (departuresWithDates.length === 0) {
        return null;
      }

      const nextDeparture = departuresWithDates[0];
      if (!nextDeparture) {
        return null;
      }

      const waitTimeMs = nextDeparture.departureTime.getTime() - requestedTime;

      return {
        departureTime: nextDeparture.departureTime,
        arrivalTime: nextDeparture.arrivalTime,
        waitTimeMinutes: Math.max(0, waitTimeMs / (60 * 1000)),
        dataSource: DataSourceType.SCHEDULED,
        tripId: nextDeparture.tripId,
      };
    } catch (error) {
      console.error(
        `[GTFSDataSource] Error fetching schedule for stop ${stopId}, route ${routeId}:`,
        error
      );
      return null;
    }
  }
}
