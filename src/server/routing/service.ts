"use strict";

import type { Stop, Route as PrismaRoute } from "@prisma/client";

import { db } from "@/server/db";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface PlanRequest {
  origin: Coordinate;
  destination: Coordinate;
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
  startStopId?: string;
  startStopName?: string;
  endStopId?: string;
  endStopName?: string;
  stopCount?: number;
}

export interface PlanItinerary {
  legs: PlanLeg[];
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  routeId?: string;
  routeName?: string;
  routeNumber?: string;
  startStopId?: string;
  endStopId?: string;
}

export interface PlanResponse {
  generatedAt: string;
  itineraries: PlanItinerary[];
}

const WALKING_SPEED_MPS = 1.4; // ~5 km/h
const BUS_SPEED_MPS = 8.33; // ~30 km/h average urban speed
const BUS_DWELL_SECONDS = 30;
const DEFAULT_MAX_WALK_METERS = 1000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function haversineDistanceMeters(a: Coordinate, b: Coordinate) {
  const R = 6371_000; // metres
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);

  const aa = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));

  return R * c;
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
  return db.route.findMany({
    include: {
      stops: {
        orderBy: {
          sequence: "asc",
        },
      },
    },
  });
}

interface Candidate {
  route: PrismaRoute & { stops: Stop[] };
  startStop: Stop;
  endStop: Stop;
  startDistanceMeters: number;
  endDistanceMeters: number;
  busDistanceMeters: number;
  stopCount: number;
}

function buildLegs(candidate: Candidate, origin: Coordinate, destination: Coordinate): PlanLeg[] {
  const { route, startStop, endStop, startDistanceMeters, endDistanceMeters, busDistanceMeters, stopCount } =
    candidate;

  const walkingToStopMinutes = walkingTimeMinutes(startDistanceMeters);
  const walkingFromStopMinutes = walkingTimeMinutes(endDistanceMeters);
  const busMinutes = busTimeMinutes(busDistanceMeters, stopCount);

  const walkLegStart: PlanLeg = {
    type: "walk",
    distanceMeters: startDistanceMeters,
    durationMinutes: walkingToStopMinutes,
    start: origin,
    end: { latitude: startStop.latitude, longitude: startStop.longitude },
  };

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
  };

  const walkLegEnd: PlanLeg = {
    type: "walk",
    distanceMeters: endDistanceMeters,
    durationMinutes: walkingFromStopMinutes,
    start: { latitude: endStop.latitude, longitude: endStop.longitude },
    end: destination,
  };

  return [walkLegStart, busLeg, walkLegEnd];
}

function buildItinerary(candidate: Candidate, origin: Coordinate, destination: Coordinate): PlanItinerary {
  const legs = buildLegs(candidate, origin, destination);
  const totalDistanceMeters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
  const totalDurationMinutes = legs.reduce((sum, leg) => sum + leg.durationMinutes, 0);

  return {
    legs,
    totalDistanceMeters,
    totalDurationMinutes,
    routeId: candidate.route.id,
    routeName: candidate.route.name,
    routeNumber: candidate.route.number,
    startStopId: candidate.startStop.id,
    endStopId: candidate.endStop.id,
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
  };

  return {
    legs: [leg],
    totalDistanceMeters: distanceMeters,
    totalDurationMinutes: durationMinutes,
  };
}

export async function planItineraries(request: PlanRequest): Promise<PlanResponse> {
  const {
    origin,
    destination,
    maxWalkingDistanceMeters = DEFAULT_MAX_WALK_METERS,
    limit: rawLimit,
  } = request;

  const limit = normalizeLimit(rawLimit);
  const network = await fetchNetwork();

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
          startDistanceMeters: start.distance,
          endDistanceMeters: end.distance,
          busDistanceMeters: busDistance,
          stopCount,
        });
      }
    }
  }

  const itineraries: PlanItinerary[] = candidates
    .map((candidate) => buildItinerary(candidate, origin, destination))
    .sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes)
    .slice(0, limit);

  if (!itineraries.length) {
    itineraries.push(buildDirectWalk(origin, destination));
  } else {
    itineraries.push(buildDirectWalk(origin, destination));
    itineraries.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);
    itineraries.splice(limit);
  }

  return {
    generatedAt: new Date().toISOString(),
    itineraries,
  };
}
