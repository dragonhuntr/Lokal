"use strict";

import type { Stop, Route as PrismaRoute } from "@prisma/client";

import { db } from "@/server/db";
import { fetchRoutes } from "@/server/bus-api";
import { departureOrchestrator } from "./data-sources/orchestrator";
import { DataSourceType } from "./data-sources/base";
import { haversineDistance } from "@/utils/geo";

// Map new DataSourceType enum to old string type for backward compatibility
export type DataSource = "realtime" | "scheduled" | "estimated";

export interface Coordinate {
  latitude: number;
  longitude: number;
  stopId?: string;
  stopName?: string;
  sequence?: number;
  bufferMinutes?: number; // Time to spend at this location before continuing
  purpose?: string; // Optional description of activity at this stop
}

export interface PlanRequest {
  origin: Coordinate;
  /**
   * @deprecated Use `destinations` to supply one or more stops instead.
   */
  destination?: Coordinate;
  destinations?: Coordinate[];
  departureTime?: Date;
  maxWalkingDistanceMeters?: number;
  limit?: number;
}

export type LegType = "walk" | "bus";

export interface PlanLeg {
  type: LegType;
  distanceMeters: number;
  durationMinutes: number;
  start: Coordinate;
  end: Coordinate;
  routeId?: string;
  routeName?: string;
  routeNumber?: string;
  routeColor?: string;
  startStopId?: string;
  startStopName?: string;
  endStopId?: string;
  endStopName?: string;
  stopCount?: number;
  /** Array of coordinates representing the path (for bus routes, includes all intermediate stops) */
  path?: Coordinate[];
  /** Actual departure time for bus legs (when available) */
  departureTime?: Date;
  /** Wait time at boarding stop in minutes (for bus legs) */
  waitTimeMinutes?: number;
  /** Data source for timing information */
  dataSource?: DataSource;
}

export interface PlanStop {
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
  bufferMinutes: number;
  purpose?: string;
  arrivalTime?: Date;
  departureTime?: Date;
}

export interface PlanItinerary {
  legs: PlanLeg[];
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  routeId?: string;
  routeName?: string;
  routeNumber?: string;
  routeColor?: string;
  startStopId?: string;
  endStopId?: string;
  /** Data source for timing information (realtime, scheduled, or estimated) */
  dataSource?: DataSource;
  /** Detailed stop information with arrival/departure/buffer times for multi-stop journeys */
  stops?: PlanStop[];
  /** Total buffer time across all stops (in minutes) */
  totalBufferMinutes?: number;
}

export interface PlanResponse {
  generatedAt: string;
  itineraries: PlanItinerary[];
}

const WALKING_SPEED_MPS = 1.4; // ~5 km/h
const BUS_SPEED_MPS = 8.33; // ~30 km/h average urban speed
const BUS_DWELL_SECONDS = 30;
const DEFAULT_MAX_WALK_METERS = 1000;
const DEFAULT_ROUTE_COLOR = '2563eb'; // Blue
const WALKING_COLOR = '6b7280'; // Gray

// Use shared haversine distance calculation
function haversineDistanceMeters(a: Coordinate, b: Coordinate) {
  return haversineDistance(a, b);
}

function minutesFromSeconds(seconds: number) {
  return seconds / 60;
}

function walkingTimeMinutes(distanceMeters: number) {
  return minutesFromSeconds(distanceMeters / WALKING_SPEED_MPS);
}

function busTimeMinutes(distanceMeters: number, stopCount: number) {
  const travelSeconds = distanceMeters / BUS_SPEED_MPS;
  const dwellSeconds = BUS_DWELL_SECONDS * Math.max(stopCount - 1, 0);
  return minutesFromSeconds(travelSeconds + dwellSeconds);
}

function sumSegmentDistance(stops: Stop[], startIndex: number, endIndex: number) {
  let total = 0;
  for (let i = startIndex; i < endIndex; i++) {
    const current = stops[i];
    const next = stops[i + 1];
    if (!current || !next) break;

    total += haversineDistanceMeters(
      { latitude: current.latitude, longitude: current.longitude },
      { latitude: next.latitude, longitude: next.longitude }
    );
  }
  return total;
}

function normalizeLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return 3;
  return Math.min(Math.max(limit, 1), 5);
}

async function fetchNetwork() {
  const routes = await db.route.findMany({
    include: {
      stops: {
        orderBy: {
          sequence: "asc",
        },
      },
    },
  });

  // For each route, get stops from a single representative trip to ensure correct ordering
  // This ensures stops are in the correct sequence for distance calculations
  for (const route of routes) {
    // Get all trips for this route with their stop counts
    const trips = await db.trip.findMany({
      where: {
        routeId: route.id,
      },
      include: {
        _count: {
          select: {
            stopTimes: true,
          },
        },
      },
    });

    if (trips.length === 0) {
      // No trips found, keep existing route.stops
      route.stops.sort((a, b) => a.sequence - b.sequence);
      continue;
    }

    // Find the trip with the most stops
    const representativeTripId = trips.reduce((max, trip) => 
      trip._count.stopTimes > max._count.stopTimes ? trip : max
    ).id;

    // Fetch the representative trip with its stopTimes
    const representativeTrip = await db.trip.findUnique({
      where: { id: representativeTripId },
      include: {
        stopTimes: {
          include: {
            stop: true,
          },
          orderBy: {
            stopSequence: "asc",
          },
        },
      },
    });

    if (representativeTrip && representativeTrip.stopTimes.length > 0) {
      // Replace route.stops with stops from the representative trip in correct order
      route.stops = representativeTrip.stopTimes.map((stopTime) => ({
        ...stopTime.stop,
        sequence: stopTime.stopSequence,
      }));
    } else {
      // Fallback: use existing route.stops if no trip found
      route.stops.sort((a, b) => a.sequence - b.sequence);
    }
  }

  return routes;
}

type Network = Awaited<ReturnType<typeof fetchNetwork>>;

interface Candidate {
  route: PrismaRoute & { stops: Stop[] };
  startStop: Stop;
  endStop: Stop;
  startStopIndex: number;
  endStopIndex: number;
  startDistanceMeters: number;
  endDistanceMeters: number;
  busDistanceMeters: number;
  stopCount: number;
}

async function buildLegs(
  candidate: Candidate,
  origin: Coordinate,
  destination: Coordinate,
  departureTime?: Date
): Promise<PlanLeg[] | null> {
  const { route, startStop, endStop, startStopIndex, endStopIndex, startDistanceMeters, endDistanceMeters, busDistanceMeters, stopCount } =
    candidate;

  const walkingToStopMinutes = walkingTimeMinutes(startDistanceMeters);
  const walkingFromStopMinutes = walkingTimeMinutes(endDistanceMeters);
  const staticBusMinutes = busTimeMinutes(busDistanceMeters, stopCount);

  // Use current time as default if departureTime is not provided
  const effectiveDepartureTime = departureTime ?? new Date();

  // Calculate when user arrives at the bus stop (after walking)
  const arrivalAtStopTime = new Date(effectiveDepartureTime.getTime() + walkingToStopMinutes * 60 * 1000);

  // Try to get departure information using orchestrator (real-time → GTFS fallback)
  let busMinutes = staticBusMinutes;
  let waitTimeMinutes = 0;
  let busDataSource: DataSource = "estimated";
  let busDepartureTime: Date | undefined;

  // Use numeric IDs directly from the database
  const stopNumericId = startStop.stopNumericId;
  const routeNumericId = route.routeNumericId;

  // Require real-time or scheduled data - no estimated fallback
  if (!stopNumericId || !routeNumericId) {
    return null;
  }

  try {
    // Use orchestrator for automatic real-time → GTFS fallback
    const nextDeparture = await departureOrchestrator.getNextDeparture(
      stopNumericId,
      routeNumericId,
      arrivalAtStopTime
    );

    if (!nextDeparture) {
      // No buses available from any source - return null
      return null;
    }

    waitTimeMinutes = nextDeparture.waitTimeMinutes;
    busDepartureTime = nextDeparture.departureTime;
    // Convert enum to string for backward compatibility
    busDataSource = nextDeparture.dataSource as DataSource;

    // If we have arrival time, use it to calculate actual travel time
    // But only if it's valid (positive and reasonable) - otherwise fall back to static estimate
    if (nextDeparture.arrivalTime) {
      const travelTimeMs = nextDeparture.arrivalTime.getTime() - nextDeparture.departureTime.getTime();
      const calculatedMinutes = travelTimeMs / (60 * 1000);
      // Only use calculated time if it's positive and at least 1 minute (to avoid invalid data)
      // For bus legs spanning multiple stops, we expect at least some travel time
      if (calculatedMinutes >= 1) {
        busMinutes = calculatedMinutes;
      }
      // Otherwise, keep staticBusMinutes (already set above)
    }
  } catch (error) {
    console.warn(`Failed to fetch departure for stop ${startStop.id}, route ${route.id}:`, error);
    // Error in orchestrator - return null, don't show itinerary
    return null;
  }

  const walkLegStart: PlanLeg = {
    type: "walk",
    distanceMeters: startDistanceMeters,
    durationMinutes: walkingToStopMinutes,
    start: origin,
    end: { latitude: startStop.latitude, longitude: startStop.longitude },
    path: [origin, { latitude: startStop.latitude, longitude: startStop.longitude }],
    dataSource: "estimated",
  };

  // Build path for bus leg including all intermediate stops with metadata
  const busPath: Coordinate[] = [];
  for (let i = startStopIndex; i <= endStopIndex; i++) {
    const stop = route.stops[i];
    if (stop) {
      busPath.push({
        latitude: stop.latitude,
        longitude: stop.longitude,
        stopId: stop.id,
        stopName: stop.name,
        sequence: stop.sequence,
      });
    }
  }

  const busLeg: PlanLeg = {
    type: "bus",
    distanceMeters: busDistanceMeters,
    durationMinutes: busMinutes,
    start: { latitude: startStop.latitude, longitude: startStop.longitude },
    end: { latitude: endStop.latitude, longitude: endStop.longitude },
    routeId: route.id,
    routeName: route.name,
    routeNumber: route.number,
    startStopId: startStop.id,
    startStopName: startStop.name,
    endStopId: endStop.id,
    endStopName: endStop.name,
    stopCount,
    path: busPath,
    departureTime: busDepartureTime,
    waitTimeMinutes: waitTimeMinutes > 0 ? waitTimeMinutes : undefined,
    dataSource: busDataSource,
  };

  const walkLegEnd: PlanLeg = {
    type: "walk",
    distanceMeters: endDistanceMeters,
    durationMinutes: walkingFromStopMinutes,
    start: { latitude: endStop.latitude, longitude: endStop.longitude },
    end: destination,
    path: [{ latitude: endStop.latitude, longitude: endStop.longitude }, destination],
    dataSource: "estimated",
  };

  return [walkLegStart, busLeg, walkLegEnd];
}

async function buildItinerary(
  candidate: Candidate,
  origin: Coordinate,
  destination: Coordinate,
  departureTime?: Date
): Promise<PlanItinerary | null> {
  const legs = await buildLegs(candidate, origin, destination, departureTime);
  
  // If buildLegs returned null, no buses are available
  if (!legs) {
    return null;
  }
  
  const totalDistanceMeters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
  
  // Total duration includes wait time at bus stop
  const totalDurationMinutes = legs.reduce((sum, leg) => {
    return sum + leg.durationMinutes + (leg.waitTimeMinutes ?? 0);
  }, 0);

  // Determine overall data source (prefer realtime > scheduled > estimated)
  const dataSources = legs
    .map((leg) => leg.dataSource)
    .filter((ds): ds is DataSource => ds !== undefined);
  let overallDataSource: DataSource = "estimated";
  if (dataSources.includes("realtime")) {
    overallDataSource = "realtime";
  } else if (dataSources.includes("scheduled")) {
    overallDataSource = "scheduled";
  }

  return {
    legs,
    totalDistanceMeters,
    totalDurationMinutes,
    routeId: candidate.route.id,
    routeName: candidate.route.name,
    routeNumber: candidate.route.number,
    startStopId: candidate.startStop.id,
    endStopId: candidate.endStop.id,
    dataSource: overallDataSource,
  };
}

function buildDirectWalk(origin: Coordinate, destination: Coordinate): PlanItinerary {
  const distanceMeters = haversineDistanceMeters(origin, destination);
  const durationMinutes = walkingTimeMinutes(distanceMeters);

  const leg: PlanLeg = {
    type: "walk",
    distanceMeters,
    durationMinutes,
    start: origin,
    end: destination,
    path: [origin, destination],
    dataSource: "estimated",
  };

  // Generate a unique route ID for walking routes based on coordinates
  const walkRouteId = `walk-${origin.latitude.toFixed(6)}-${origin.longitude.toFixed(6)}-${destination.latitude.toFixed(6)}-${destination.longitude.toFixed(6)}`;

  return {
    legs: [leg],
    totalDistanceMeters: distanceMeters,
    totalDurationMinutes: durationMinutes,
    routeId: walkRouteId,
    routeName: "Walking Route",
    routeNumber: "Walk",
    dataSource: "estimated",
  };
}

function findCandidates(
  network: Network,
  origin: Coordinate,
  destination: Coordinate,
  maxWalkingDistanceMeters: number
): Candidate[] {
  const candidates: Candidate[] = [];

  for (const route of network) {
    if (!route.stops || route.stops.length < 2) continue;

    const stops = route.stops;
    const originCandidates = stops
      .map((stop, index) => {
        const distance = haversineDistanceMeters(
          { latitude: stop.latitude, longitude: stop.longitude },
          origin
        );
        return { stop, distance, index };
      })
      .filter((entry) => entry.distance <= maxWalkingDistanceMeters);

    if (!originCandidates.length) continue;

    const destinationCandidates = stops
      .map((stop, index) => {
        const distance = haversineDistanceMeters(
          { latitude: stop.latitude, longitude: stop.longitude },
          destination
        );
        return { stop, distance, index };
      })
      .filter((entry) => entry.distance <= maxWalkingDistanceMeters);

    if (!destinationCandidates.length) continue;

    for (const start of originCandidates) {
      for (const end of destinationCandidates) {
        if (end.index <= start.index) continue;

        const stopCount = end.index - start.index + 1;
        const busDistance = sumSegmentDistance(stops, start.index, end.index);
        if (!Number.isFinite(busDistance) || busDistance <= 0) continue;

        candidates.push({
          route,
          startStop: start.stop,
          endStop: end.stop,
          startStopIndex: start.index,
          endStopIndex: end.index,
          startDistanceMeters: start.distance,
          endDistanceMeters: end.distance,
          busDistanceMeters: busDistance,
          stopCount,
        });
      }
    }
  }
  
  return candidates;
}

async function planSegmentItineraries(
  network: Network,
  origin: Coordinate,
  destination: Coordinate,
  maxWalkingDistanceMeters: number,
  limit: number,
  departureTime?: Date
): Promise<PlanItinerary[]> {
  let candidates = findCandidates(network, origin, destination, maxWalkingDistanceMeters);
  
  // If no candidates found, try to find routes with stops near origin
  // and allow walking from the closest stop to destination (even if far)
  if (candidates.length === 0) {
    // For each route, check if it has stops near origin
    for (const route of network) {
      if (!route.stops || route.stops.length < 2) continue;

      const originCandidates = route.stops
        .map((stop, index) => {
          const distance = haversineDistanceMeters(
            { latitude: stop.latitude, longitude: stop.longitude },
            origin
          );
          return { stop, distance, index };
        })
        .filter((entry) => entry.distance <= maxWalkingDistanceMeters);

      if (originCandidates.length === 0) continue;

      // Find the closest stop to destination on this route (even if far)
      const closestDestStop = route.stops
        .map((stop, index) => {
          const distance = haversineDistanceMeters(
            { latitude: stop.latitude, longitude: stop.longitude },
            destination
          );
          return { stop, distance, index };
        })
        .sort((a, b) => a.distance - b.distance)[0];

      if (!closestDestStop) continue;

      // Create candidates for each origin stop, allowing walk from closest stop to destination
      for (const start of originCandidates) {
        if (closestDestStop.index <= start.index) continue;

        const stopCount = closestDestStop.index - start.index + 1;
        const busDistance = sumSegmentDistance(route.stops, start.index, closestDestStop.index);
        if (!Number.isFinite(busDistance) || busDistance <= 0) continue;

        candidates.push({
          route,
          startStop: start.stop,
          endStop: closestDestStop.stop,
          startStopIndex: start.index,
          endStopIndex: closestDestStop.index,
          startDistanceMeters: start.distance,
          endDistanceMeters: closestDestStop.distance, // Allow walking even if far
          busDistanceMeters: busDistance,
          stopCount,
        });
      }
    }
  }

  // Build all itineraries in parallel
  const itineraryPromises = candidates.map((candidate) =>
    buildItinerary(candidate, origin, destination, departureTime)
  );
  const allItineraries = await Promise.all(itineraryPromises);
  
  // Filter out null itineraries (no buses available)
  // Also filter out itineraries with bus legs that have no actual departure times
  const itineraries = allItineraries.filter(
    (itinerary): itinerary is PlanItinerary => {
      if (!itinerary) return false;

      // Check if any bus leg has no departure time
      const hasBusLegWithoutDeparture = itinerary.legs.some(
        (leg) => leg.type === "bus" && !leg.departureTime
      );

      // ALWAYS require bus legs to have departure times
      // If a bus leg doesn't have a departure time, it means no buses are running
      if (hasBusLegWithoutDeparture) {
        return false;
      }

      return true;
    }
  );
  
  const sortedItineraries = itineraries
    .sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes)
    .slice(0, limit);

  const directWalk = buildDirectWalk(origin, destination);
  
  if (!sortedItineraries.length) {
    return [directWalk];
  } else {
    const withWalk = [...sortedItineraries, directWalk];
    withWalk.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);
    return withWalk.slice(0, limit);
  }
}

interface CombinedItinerary {
  legs: PlanLeg[];
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  firstSegment?: Pick<PlanItinerary, "routeId" | "routeName" | "routeNumber" | "startStopId">;
  lastSegment?: Pick<PlanItinerary, "endStopId">;
  segmentCount: number;
}

/**
 * Extracts the actual journey start time from a planned itinerary.
 * For "leave now" mode (no specified departure time), uses the first bus departure.
 * For "leave at specific time" mode, uses the provided departure time.
 */
function getJourneyStartTime(
  itinerary: PlanItinerary,
  requestedDepartureTime?: Date
): Date | null {
  if (requestedDepartureTime) {
    return requestedDepartureTime;
  }

  // Find first bus leg with departure time
  const firstBusLeg = itinerary.legs.find((leg) => leg.type === "bus" && leg.departureTime);
  if (!firstBusLeg?.departureTime) {
    return null;
  }

  // Walk backwards from bus departure to find journey start
  const busDepartureTime = new Date(firstBusLeg.departureTime);
  let walkDurationBeforeBus = 0;

  for (const leg of itinerary.legs) {
    if (leg === firstBusLeg) break;
    walkDurationBeforeBus += leg.durationMinutes;
  }

  return new Date(busDepartureTime.getTime() - walkDurationBeforeBus * 60 * 1000);
}

/**
 * Calculates when we arrive at the destination of an itinerary.
 */
function getJourneyArrivalTime(
  itinerary: PlanItinerary,
  requestedDepartureTime?: Date
): Date | null {
  const startTime = getJourneyStartTime(itinerary, requestedDepartureTime);
  if (!startTime) return null;

  return new Date(startTime.getTime() + itinerary.totalDurationMinutes * 60 * 1000);
}

/**
 * Calculate stop times for a multi-stop journey based on its combined legs.
 * This traces through all legs and calculates arrival/departure at each destination.
 */
function calculateStopTimesFromLegs(
  legs: PlanLeg[],
  destinations: Coordinate[],
  origin: Coordinate,
  requestedDepartureTime?: Date
): PlanStop[] {
  const stops: PlanStop[] = [];

  // Get journey start time
  const firstBusLeg = legs.find((leg) => leg.type === "bus" && leg.departureTime);
  let currentTime: Date;

  if (requestedDepartureTime) {
    currentTime = new Date(requestedDepartureTime);
  } else if (firstBusLeg?.departureTime) {
    // Walk backwards from first bus to find journey start
    const busDepartureTime = new Date(firstBusLeg.departureTime);
    let walkDurationBeforeBus = 0;
    for (const leg of legs) {
      if (leg === firstBusLeg) break;
      walkDurationBeforeBus += leg.durationMinutes;
    }
    currentTime = new Date(busDepartureTime.getTime() - walkDurationBeforeBus * 60 * 1000);
  } else {
    currentTime = new Date();
  }

  // Add origin stop
  stops.push({
    name: origin.stopName ?? "Origin",
    latitude: origin.latitude,
    longitude: origin.longitude,
    sequence: 0,
    bufferMinutes: 0,
    purpose: origin.purpose,
    arrivalTime: undefined,
    departureTime: new Date(currentTime),
  });

  // Track our progress through legs for each destination
  let destIndex = 0;
  let legIndex = 0;

  while (destIndex < destinations.length && legIndex < legs.length) {
    const dest = destinations[destIndex];
    if (!dest) break;

    // Find legs that end at or near this destination
    // We'll accumulate time until we reach this destination
    let travelTime = 0;
    let foundDestination = false;

    while (legIndex < legs.length) {
      const leg = legs[legIndex];
      if (!leg) break;

      // Add this leg's duration
      if (leg.type === "bus" && leg.departureTime) {
        // For bus legs with departure time, jump to that time + duration
        currentTime = new Date(new Date(leg.departureTime).getTime() + leg.durationMinutes * 60 * 1000);
      } else {
        currentTime = new Date(currentTime.getTime() + leg.durationMinutes * 60 * 1000);
      }

      legIndex++;

      // Check if this leg ends at the destination
      // Compare coordinates (with small tolerance for floating point)
      const endsAtDest =
        Math.abs(leg.end.latitude - dest.latitude) < 0.0001 &&
        Math.abs(leg.end.longitude - dest.longitude) < 0.0001;

      if (endsAtDest) {
        foundDestination = true;
        break;
      }
    }

    if (foundDestination) {
      const arrivalTime = new Date(currentTime);
      const bufferMinutes = dest.bufferMinutes ?? 0;
      const departureTime = destIndex < destinations.length - 1
        ? new Date(arrivalTime.getTime() + bufferMinutes * 60 * 1000)
        : undefined;

      stops.push({
        name: dest.stopName ?? `Stop ${destIndex + 1}`,
        latitude: dest.latitude,
        longitude: dest.longitude,
        sequence: destIndex + 1,
        bufferMinutes,
        purpose: dest.purpose,
        arrivalTime,
        departureTime,
      });

      // Update current time to include buffer
      if (departureTime) {
        currentTime = departureTime;
      }
    }

    destIndex++;
  }

  return stops;
}

export async function planItineraries(request: PlanRequest): Promise<PlanResponse> {
  const {
    origin,
    destination,
    destinations,
    maxWalkingDistanceMeters = DEFAULT_MAX_WALK_METERS,
    limit: rawLimit,
  } = request;

  const normalizedDestinations = destinations?.length
    ? destinations
    : destination
      ? [destination]
      : [];

  if (!normalizedDestinations.length) {
    throw new Error("At least one destination must be provided");
  }

  const limit = normalizeLimit(rawLimit);
  const network = await fetchNetwork();

  // Fetch route colors from the bus API
  const busRoutes = await fetchRoutes();
  const routeColorMap = new Map<string, string>();
  busRoutes.forEach((route) => {
    routeColorMap.set(route.ShortName, route.Color);
    routeColorMap.set(route.LongName, route.Color);
    routeColorMap.set(route.RouteId.toString(), route.Color);
  });

  const departureTime = request.departureTime;

  if (normalizedDestinations.length === 1) {
    const finalDestination = normalizedDestinations[0];
    if (!finalDestination) {
      throw new Error("Destination is required");
    }
    const itineraries = await planSegmentItineraries(
      network,
      origin,
      finalDestination,
      maxWalkingDistanceMeters,
      limit,
      departureTime
    );

    // Add colors to itineraries
    itineraries.forEach((itinerary) => {
      if (itinerary.routeNumber && itinerary.routeNumber !== 'Walk') {
        itinerary.routeColor =
          routeColorMap.get(itinerary.routeNumber) ??
          routeColorMap.get(itinerary.routeName ?? "") ??
          DEFAULT_ROUTE_COLOR;
      } else if (itinerary.routeNumber === 'Walk') {
        itinerary.routeColor = WALKING_COLOR;
      } else {
        itinerary.routeColor = DEFAULT_ROUTE_COLOR;
      }

      itinerary.legs.forEach((leg) => {
        if (leg.type === "bus" && leg.routeNumber) {
          leg.routeColor =
            routeColorMap.get(leg.routeNumber) ??
            routeColorMap.get(leg.routeName ?? "") ??
            DEFAULT_ROUTE_COLOR;
        } else if (leg.type === "walk") {
          leg.routeColor = WALKING_COLOR;
        }
      });
    });

    return {
      generatedAt: new Date().toISOString(),
      itineraries,
    };
  }

  let currentOrigin = origin;
  let currentDepartureTime = departureTime;
  let combined: CombinedItinerary[] = [
    {
      legs: [],
      totalDistanceMeters: 0,
      totalDurationMinutes: 0,
      segmentCount: 0,
    },
  ];

  // Process destinations sequentially to handle multi-segment journeys
  for (let i = 0; i < normalizedDestinations.length; i++) {
    const currentDestination = normalizedDestinations[i];
    if (!currentDestination) continue;

    // Plan this segment from current origin to current destination
    const segmentItineraries = await planSegmentItineraries(
      network,
      currentOrigin,
      currentDestination,
      maxWalkingDistanceMeters,
      limit,
      currentDepartureTime
    );

    const nextCombined: CombinedItinerary[] = [];
    const bufferMinutes = currentDestination.bufferMinutes ?? 0;

    // Combine each partial journey with each segment itinerary
    for (const partial of combined) {
      for (const segment of segmentItineraries) {
        nextCombined.push({
          legs: [...partial.legs, ...segment.legs],
          totalDistanceMeters: partial.totalDistanceMeters + segment.totalDistanceMeters,
          totalDurationMinutes: partial.totalDurationMinutes + segment.totalDurationMinutes + bufferMinutes,
          firstSegment: partial.firstSegment ?? {
            routeId: segment.routeId,
            routeName: segment.routeName,
            routeNumber: segment.routeNumber,
            startStopId: segment.startStopId,
          },
          lastSegment: { endStopId: segment.endStopId },
          segmentCount: partial.segmentCount + 1,
        });
      }
    }

    nextCombined.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);
    combined = nextCombined.slice(0, limit);

    // Calculate next segment's departure time using the best segment
    const bestSegment = segmentItineraries[0];
    if (bestSegment) {
      const arrivalTime = getJourneyArrivalTime(bestSegment, currentDepartureTime);
      if (arrivalTime) {
        currentDepartureTime = new Date(arrivalTime.getTime() + bufferMinutes * 60 * 1000);
      }
    }

    // Update origin for next segment
    currentOrigin = currentDestination;
  }

  const itineraries: PlanItinerary[] = combined.map((entry) => {
    const isMultiSegment = entry.segmentCount > 1;
    const routeName = isMultiSegment
      ? `Multi-stop journey (${entry.segmentCount} segments)`
      : entry.firstSegment?.routeName;

    const routeNumber = isMultiSegment ? undefined : entry.firstSegment?.routeNumber;
    const routeColor = routeNumber && routeNumber !== 'Walk'
      ? routeColorMap.get(routeNumber) ??
        routeColorMap.get(routeName ?? "") ??
        DEFAULT_ROUTE_COLOR
      : routeNumber === 'Walk'
      ? WALKING_COLOR
      : DEFAULT_ROUTE_COLOR;

    // Calculate stop times for THIS specific itinerary based on its actual legs
    const stops = calculateStopTimesFromLegs(entry.legs, normalizedDestinations, origin, departureTime);
    const totalBufferMinutes = stops.reduce((sum, stop) => sum + stop.bufferMinutes, 0);

    return {
      legs: entry.legs,
      totalDistanceMeters: entry.totalDistanceMeters,
      totalDurationMinutes: entry.totalDurationMinutes,
      routeId: isMultiSegment ? undefined : entry.firstSegment?.routeId,
      routeName,
      routeNumber,
      routeColor,
      startStopId: entry.firstSegment?.startStopId,
      endStopId: entry.lastSegment?.endStopId,
      stops,
      totalBufferMinutes,
    };
  });

  // Add colors to legs
  itineraries.forEach((itinerary) => {
    itinerary.legs.forEach((leg) => {
      if (leg.type === "bus" && leg.routeNumber) {
        leg.routeColor = routeColorMap.get(leg.routeNumber) ??
                        routeColorMap.get(leg.routeName ?? "") ??
                        DEFAULT_ROUTE_COLOR;
      } else if (leg.type === "walk") {
        leg.routeColor = WALKING_COLOR;
      }
    });
  });

  itineraries.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);
  itineraries.splice(limit);

  return {
    generatedAt: new Date().toISOString(),
    itineraries,
  };
}
