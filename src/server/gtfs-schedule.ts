import { db } from "@/server/db";
import { parseGTFSTime, gtfsTimeToMinutes } from "../../prisma/gtfs-parser";

export interface ScheduledDeparture {
  tripId: string;
  routeId: string;
  routeName: string;
  routeNumber: string;
  headsign: string;
  departureTime: string;
  arrivalTime: string;
  stopSequence: number;
  isTimepoint: boolean;
  directionId: number;
  serviceId: number;
}

/**
 * Get scheduled departures for a stop
 * @param stopNumericId The numeric ID of the stop from GTFS
 * @param date The date to get departures for (defaults to today)
 * @param afterTime Optional time filter (HH:MM format) - only return departures after this time
 * @param limit Maximum number of departures to return
 */
export async function getScheduledDepartures(
  stopNumericId: number,
  date: Date = new Date(),
  afterTime?: string,
  limit: number = 20
): Promise<ScheduledDeparture[]> {
  // Find the stop in our database
  const stop = await db.stop.findFirst({
    where: { stopNumericId },
  });

  if (!stop) {
    return [];
  }

  // Get all stop times for this stop - ignore service dates, just use weekly patterns
  const stopTimes = await db.stopTime.findMany({
    where: {
      stopId: stop.id,
    },
    include: {
      trip: {
        include: {
          route: true,
        },
      },
    },
    orderBy: {
      departureTime: 'asc',
    },
    take: limit * 3, // Get more to account for filtering
  });

  // Filter by time if provided
  let filteredStopTimes = stopTimes;
  if (afterTime) {
    const afterMinutes = timeToMinutes(afterTime);
    filteredStopTimes = stopTimes.filter(st => {
      const depMinutes = gtfsTimeToMinutes(st.departureTime);
      return depMinutes >= afterMinutes;
    });
  } else {
    // If no afterTime specified, filter by current time of day
    const queryTime = date.getHours() * 60 + date.getMinutes();
    filteredStopTimes = stopTimes.filter(st => {
      const depMinutes = gtfsTimeToMinutes(st.departureTime);
      return depMinutes >= queryTime;
    });
  }

  // Limit results
  const limitedStopTimes = filteredStopTimes.slice(0, limit);

  // Map to our response format
  return limitedStopTimes.map(st => ({
    tripId: st.trip.gtfsTripId,
    routeId: st.trip.route.id,
    routeName: st.trip.route.name,
    routeNumber: st.trip.route.number,
    headsign: st.trip.headsign,
    departureTime: st.departureTime,
    arrivalTime: st.arrivalTime,
    stopSequence: st.stopSequence,
    isTimepoint: st.isTimepoint,
    directionId: st.trip.directionId,
    serviceId: st.trip.serviceId,
  }));
}

/**
 * Get all departures for a route at a specific stop
 */
export async function getRouteDeparturesAtStop(
  routeNumericId: number,
  stopNumericId: number,
  date: Date = new Date(),
  limit: number = 20
): Promise<ScheduledDeparture[]> {
  // Find the route and stop
  const route = await db.route.findUnique({
    where: { routeNumericId },
  });

  const stop = await db.stop.findFirst({
    where: { stopNumericId },
  });

  if (!route || !stop) {
    return [];
  }

  // Get stop times for this route and stop - ignore service dates, just use weekly patterns
  const stopTimes = await db.stopTime.findMany({
    where: {
      stopId: stop.id,
      trip: {
        routeId: route.id,
      },
    },
    include: {
      trip: {
        include: {
          route: true,
        },
      },
    },
    orderBy: {
      departureTime: 'asc',
    },
    take: limit * 3, // Get more to account for filtering
  });

  // Return all stop times - let the caller filter by time
  // GTFS times are stored as strings like "14:30:00" and can be > 24 hours
  const limitedStopTimes = stopTimes.slice(0, limit);

  return limitedStopTimes.map(st => ({
    tripId: st.trip.gtfsTripId,
    routeId: st.trip.route.id,
    routeName: st.trip.route.name,
    routeNumber: st.trip.route.number,
    headsign: st.trip.headsign,
    departureTime: st.departureTime,
    arrivalTime: st.arrivalTime,
    stopSequence: st.stopSequence,
    isTimepoint: st.isTimepoint,
    directionId: st.trip.directionId,
    serviceId: st.trip.serviceId,
  }));
}

/**
 * Get the full schedule for a trip
 */
export async function getTripSchedule(gtfsTripId: string) {
  const trip = await db.trip.findUnique({
    where: { gtfsTripId },
    include: {
      route: true,
      stopTimes: {
        include: {
          stop: true,
        },
        orderBy: {
          stopSequence: 'asc',
        },
      },
    },
  });

  if (!trip) {
    return null;
  }

  return {
    tripId: trip.gtfsTripId,
    routeName: trip.route.name,
    routeNumber: trip.route.number,
    headsign: trip.headsign,
    directionId: trip.directionId,
    stops: trip.stopTimes.map(st => ({
      stopId: st.stop.stopNumericId,
      stopName: st.stop.name,
      latitude: st.stop.latitude,
      longitude: st.stop.longitude,
      arrivalTime: st.arrivalTime,
      departureTime: st.departureTime,
      sequence: st.stopSequence,
      isTimepoint: st.isTimepoint,
    })),
  };
}

/**
 * Convert HH:MM time string to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(s => parseInt(s, 10));
  return hours * 60 + minutes;
}

/**
 * Format GTFS time (which can be > 24:00) to a readable format
 */
export function formatGTFSTime(timeStr: string): string {
  const { hours, minutes, seconds } = parseGTFSTime(timeStr);

  if (hours >= 24) {
    // Next day
    const actualHours = hours - 24;
    const period = actualHours >= 12 ? 'AM' : 'AM';
    const displayHours = actualHours === 0 ? 12 : actualHours > 12 ? actualHours - 12 : actualHours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period} (next day)`;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
