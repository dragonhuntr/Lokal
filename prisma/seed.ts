"use strict";

import { PrismaClient } from "@prisma/client";
import { fetchRoutes, fetchRouteDetails, fetchAllStops, fetchStopDepartures } from "../src/server/bus-api";

const prisma = new PrismaClient();

const ROUTE_ID_PREFIX = "route-";
const STOP_ID_PREFIX = "stop-";

function buildRouteId(routeNumericId: number) {
  return `${ROUTE_ID_PREFIX}${routeNumericId}`;
}

function buildStopId(routeNumericId: number, stopNumericId: number, sequence: number) {
  return `${STOP_ID_PREFIX}${routeNumericId}-${stopNumericId}-${sequence}`;
}

async function seedRoutesAndStops() {
  const routes = await fetchRoutes();
  if (!routes.length) {
    console.warn("No routes returned from upstream API. Skipping seed.");
    return;
  }

  console.log(`Fetched ${routes.length} routes from API`);

  // Clear dependent tables first to avoid FK conflicts.
  // Delete in order of dependencies: deepest first
  await prisma.alert.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.savedRoute.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.stop.deleteMany();
  await prisma.route.deleteMany();

  // Try to fetch all stops and build route-to-stops mapping from departures
  console.log("Fetching stop departures to map stops to routes...");
  const allStopDepartures = await fetchStopDepartures();
  console.log(`Fetched ${allStopDepartures.length} stop departure records`);

  // Fetch all stops data
  console.log("Fetching all stops...");
  const allStops = await fetchAllStops();
  console.log(`Fetched ${allStops.length} stops`);

  // Build a map of route ID to stops
  const routeStopsMap = new Map<number, Array<{ stopId: number; name: string; lat: number; lon: number }>>();

  for (const stopDeparture of allStopDepartures) {
    const stopData = allStops.find(s => s.StopId === stopDeparture.StopId);
    if (!stopData) continue;

    for (const routeDir of stopDeparture.RouteDirections) {
      const routeId = parseInt(routeDir.RouteId);
      if (isNaN(routeId)) continue;

      if (!routeStopsMap.has(routeId)) {
        routeStopsMap.set(routeId, []);
      }

      const stops = routeStopsMap.get(routeId)!;
      // Avoid duplicates
      if (!stops.some(s => s.stopId === stopData.StopId)) {
        stops.push({
          stopId: stopData.StopId,
          name: stopData.Name,
          lat: stopData.Latitude,
          lon: stopData.Longitude,
        });
      }
    }
  }

  console.log(`Mapped stops to ${routeStopsMap.size} routes`);

  for (const route of routes) {
    try {
      // Try to get stops from our mapping first
      const mappedStops = routeStopsMap.get(route.RouteId) ?? [];

      // Fallback to route details API if no mapped stops
      let stops = mappedStops;
      if (stops.length === 0) {
        const details = await fetchRouteDetails(route.RouteId);
        stops = (details.Stops ?? [])
          .filter(
            (stop) =>
              Number.isFinite(stop.Latitude) &&
              Number.isFinite(stop.Longitude) &&
              (stop.Latitude !== 0 || stop.Longitude !== 0)
          )
          .map(s => ({
            stopId: s.StopId,
            name: s.Name,
            lat: s.Latitude,
            lon: s.Longitude,
          }));
      }

      const origin = stops[0]?.name ?? route.LongName ?? route.ShortName;
      const destination = stops[stops.length - 1]?.name ?? route.LongName ?? route.ShortName;
      const totalStops = stops.length;
      const approximateDurationMinutes = totalStops > 1 ? totalStops * 4 : 0;

      console.log(`Seeding route ${route.RouteId} (${route.ShortName}) with ${stops.length} stops`);

      await prisma.route.create({
        data: {
          id: buildRouteId(route.RouteId),
          name: route.LongName || route.ShortName || `Route ${route.RouteId}`,
          number: route.ShortName || String(route.RouteId),
          origin,
          destination,
          totalStops,
          duration: approximateDurationMinutes,
          stops: {
            create: stops.map((stop, index) => ({
              id: buildStopId(route.RouteId, stop.stopId, index),
              name: stop.name,
              latitude: stop.lat,
              longitude: stop.lon,
              sequence: index,
            })),
          },
        },
      });
    } catch (error) {
      console.error(`Failed to seed route ${route.RouteId}:`, error);
    }
  }

  console.log("Seeding complete!");
}

async function main() {
  await seedRoutesAndStops();
}

main()
  .catch((error) => {
    console.error("Seeding failed with fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
