import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  fetchRoutes,
  fetchRouteDetails,
  fetchStopDepartures,
  fetchAllStops,
  fetchRouteKML,
} from "@/server/bus-api";

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
});
