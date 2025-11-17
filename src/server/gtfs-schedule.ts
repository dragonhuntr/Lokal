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

  // Normalize date for comparison - use same method as parseGTFSDate to ensure consistency
  // parseGTFSDate creates dates in local timezone: new Date(year, month - 1, day)
  // This ensures dates match how they were stored in the database
  const queryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Check if any service dates exist for this date (to know if GTFS data covers this date)
  const anyServiceDatesForDate = await db.serviceDate.findFirst({
    where: {
      date: queryDate,
    },
  });

  // Get all service dates for this date that are active
  // exceptionType: 1 = service added (runs), 2 = service removed (doesn't run)
  const serviceDates = await db.serviceDate.findMany({
    where: {
      date: queryDate,
      exceptionType: 1, // Only get services that are active on this date
    },
  });

  // Extract service IDs that are active on this date
  const activeServiceIds = serviceDates.length > 0 ? new Set(serviceDates.map(sd => sd.serviceId)) : null;

  // If service dates exist for this date but no active services, buses don't run - return empty
  if (anyServiceDatesForDate && (!activeServiceIds || activeServiceIds.size === 0)) {
    return [];
  }

  // Build query - filter by service dates if available
  // Only fall back to all trips if service dates don't exist at all (future date beyond GTFS range)
  const stopTimesWhere: Parameters<typeof db.stopTime.findMany>[0]['where'] = {
    stopId: stop.id,
  };

  if (activeServiceIds && activeServiceIds.size > 0) {
    // Filter by active services for this date
    stopTimesWhere.trip = {
      serviceId: {
        in: Array.from(activeServiceIds),
      },
    };
  }

  // Get all stop times for this stop, optionally filtered by active services
  const stopTimes = await db.stopTime.findMany({
    where: stopTimesWhere,
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

  // Normalize date for comparison - use same method as parseGTFSDate to ensure consistency
  // parseGTFSDate creates dates in local timezone: new Date(year, month - 1, day)
  // This ensures dates match how they were stored in the database
  const queryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Check if any service dates exist for this date (to know if GTFS data covers this date)
  const anyServiceDatesForDate = await db.serviceDate.findFirst({
    where: {
      date: queryDate,
    },
  });

  // Get all service dates for this date that are active
  // exceptionType: 1 = service added (runs), 2 = service removed (doesn't run)
  const serviceDates = await db.serviceDate.findMany({
    where: {
      date: queryDate,
      exceptionType: 1, // Only get services that are active on this date
    },
  });

  // Extract service IDs that are active on this date
  const activeServiceIds = serviceDates.length > 0 ? new Set(serviceDates.map(sd => sd.serviceId)) : null;

  // If service dates exist for this date but no active services, buses don't run - return empty
  if (anyServiceDatesForDate && (!activeServiceIds || activeServiceIds.size === 0)) {
    return [];
  }

  // Build query - filter by service dates if available
  // Only fall back to all trips if service dates don't exist at all (future date beyond GTFS range)
  const stopTimesWhere: Parameters<typeof db.stopTime.findMany>[0]['where'] = {
    stopId: stop.id,
    trip: {
      routeId: route.id,
    },
  };

  if (activeServiceIds && activeServiceIds.size > 0) {
    // Filter by active services for this date
    stopTimesWhere.trip = {
      routeId: route.id,
      serviceId: {
        in: Array.from(activeServiceIds),
      },
    };
  }

  // Get stop times for this route and stop, optionally filtered by active services
  const stopTimes = await db.stopTime.findMany({
    where: stopTimesWhere,
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
