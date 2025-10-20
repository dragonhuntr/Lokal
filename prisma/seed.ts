"use strict";

import { PrismaClient } from "@prisma/client";
import { fetchRoutes, fetchRouteDetails } from "../src/server/bus-api";

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

  // Clear dependent tables first to avoid FK conflicts.
  await prisma.stop.deleteMany();
  await prisma.route.deleteMany();

  for (const route of routes) {
    try {
      const details = await fetchRouteDetails(route.RouteId);
      const stops = (details.Stops ?? []).filter(
        (stop) =>
          Number.isFinite(stop.Latitude) &&
          Number.isFinite(stop.Longitude) &&
          (stop.Latitude !== 0 || stop.Longitude !== 0)
      );

      const origin = stops[0]?.Name ?? details.LongName ?? route.LongName ?? route.ShortName;
      const destination =
        stops[stops.length - 1]?.Name ?? details.GoogleDescription ?? origin ?? route.ShortName;
      const totalStops = stops.length;
      const approximateDurationMinutes = totalStops > 1 ? totalStops * 4 : 0;

      await prisma.route.create({
        data: {
          id: buildRouteId(route.RouteId),
          name: details.LongName || route.LongName || route.ShortName || `Route ${route.RouteId}`,
          number: route.ShortName || String(route.RouteId),
          origin,
          destination,
          totalStops,
          duration: approximateDurationMinutes,
          stops: {
            create: stops.map((stop, index) => ({
              id: buildStopId(route.RouteId, stop.StopId, index),
              name: stop.Name,
              latitude: stop.Latitude,
              longitude: stop.Longitude,
              sequence: index,
            })),
          },
        },
      });
    } catch (error) {
      console.error(`Failed to seed route ${route.RouteId}:`, error);
    }
  }
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
