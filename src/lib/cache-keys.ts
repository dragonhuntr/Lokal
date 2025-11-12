/**
 * Cache key constants and TTL values for Redis caching
 */

// Cache key prefixes
export const CACHE_KEYS = {
  DEPARTURES: "departures:all",
  DEPARTURES_BY_STOP: (stopId: number) => `departures:stop:${stopId}`,
  STOPS: "stops:all",
  VEHICLES: "vehicles:all",
  ROUTE_DETAILS: (routeId: number) => `route:details:${routeId}`,
  ROUTE_KML: (routeId: number) => `route:kml:${routeId}`,
  ROUTES: "routes:all",
} as const;

// TTL values in seconds
export const CACHE_TTL = {
  DEPARTURES: 30, // 30 seconds - real-time data
  STOPS: 300, // 5 minutes - static data
  VEHICLES: 10, // 10 seconds - very real-time data
  ROUTE_DETAILS: 300, // 5 minutes
  ROUTE_KML: 3600, // 1 hour - rarely changes
  ROUTES: 600, // 10 minutes
} as const;
