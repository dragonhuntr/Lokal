import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  fetchRoutes,
  fetchRouteDetails,
  fetchStopDepartures,
  fetchAllStops,
  fetchRouteKML,
  fetchAllVehicles,
} from "@/server/bus-api";
import {
  getScheduledDepartures,
  getRouteDeparturesAtStop,
  getTripSchedule,
} from "@/server/gtfs-schedule";

export const busRouter = createTRPCRouter({
  // Get all visible routes
  getRoutes: publicProcedure
    .query(async () => {
      const routes = await fetchRoutes();
      if (!routes.length) {
        console.error("bus.getRoutes returned 0 routes");
      }
      return routes;
    }),

  // Get detailed information for a specific route
  getRouteDetails: publicProcedure
    .input(z.object({ routeId: z.number() }))
    .query(async ({ input }) => {
      return await fetchRouteDetails(input.routeId);
    }),

  // Get route KML data for mapping
  getRouteKML: publicProcedure
    .input(z.object({ routeId: z.number() }))
    .query(async ({ input }) => {
      return await fetchRouteKML(input.routeId);
    }),

  // Get stop departures for all stops or a specific stop
  getStopDepartures: publicProcedure
    .input(z.object({ stopId: z.number().optional() }))
    .query(async ({ input }) => {
      return await fetchStopDepartures(input.stopId);
    }),

  // Get all bus stops
  getAllStops: publicProcedure
    .query(async () => {
      return await fetchAllStops();
    }),

  // Get all vehicles from all routes
  getAllVehicles: publicProcedure
    .query(async () => {
      return await fetchAllVehicles();
    }),

  // Prefetch route details for multiple routes (background prefetching)
  prefetchRouteDetails: publicProcedure
    .input(z.object({ routeIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      // Prefetch route details in parallel
      // This warms up the Redis cache for faster subsequent requests
      const prefetchPromises = input.routeIds.map((routeId) =>
        fetchRouteDetails(routeId).catch((error) => {
          // Silently fail for individual routes to not block others
          console.warn(`Failed to prefetch route ${routeId}:`, error);
          return null;
        })
      );

      // Wait for all prefetches to complete to ensure cache is populated
      // This ensures routes are cached before the mutation returns
      await Promise.allSettled(prefetchPromises);

      return { success: true, count: input.routeIds.length };
    }),

  // Get scheduled departures from GTFS data for a specific stop
  getScheduledDepartures: publicProcedure
    .input(z.object({
      stopNumericId: z.number(),
      date: z.date().optional(),
      afterTime: z.string().optional(), // HH:MM format
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      return await getScheduledDepartures(
        input.stopNumericId,
        input.date,
        input.afterTime,
        input.limit
      );
    }),

  // Get scheduled departures for a specific route at a specific stop
  getRouteDeparturesAtStop: publicProcedure
    .input(z.object({
      routeNumericId: z.number(),
      stopNumericId: z.number(),
      date: z.date().optional(),
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      return await getRouteDeparturesAtStop(
        input.routeNumericId,
        input.stopNumericId,
        input.date,
        input.limit
      );
    }),

  // Get full schedule for a specific trip
  getTripSchedule: publicProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ input }) => {
      return await getTripSchedule(input.tripId);
    }),
});
