/**
 * Development mode fake bus data generator
 * Generates realistic fake buses for testing when NODE_ENV is "development"
 */

import type { RouteDetails } from "@/server/bus-api";

interface FakeBusConfig {
  routeId: number;
  stops: RouteDetails["Stops"];
  color?: string;
}

/**
 * Generate fake vehicles along a route for development/testing
 */
export function generateFakeBuses(config: FakeBusConfig): RouteDetails["Vehicles"] {
  const { routeId, stops } = config;

  if (!stops || stops.length < 2) {
    console.log(`[DEV MODE] Cannot generate buses for route ${routeId}: insufficient stops (${stops?.length ?? 0} stops)`);
    return [];
  }

  console.log(`[DEV MODE] Generating fake buses for route ${routeId} with ${stops.length} stops`);

  // Generate 2-4 fake buses per route
  const busCount = Math.floor(Math.random() * 3) + 2;
  const vehicles: RouteDetails["Vehicles"] = [];

  for (let i = 0; i < busCount; i++) {
    // Place bus at a random position along the route
    const stopIndex = Math.floor(Math.random() * stops.length);
    const currentStop = stops[stopIndex];
    const nextStop = stops[Math.min(stopIndex + 1, stops.length - 1)];

    if (!currentStop || !nextStop) continue;

    // Interpolate position between current and next stop
    const progress = Math.random();
    const latitude = currentStop.Latitude + (nextStop.Latitude - currentStop.Latitude) * progress;
    const longitude = currentStop.Longitude + (nextStop.Longitude - currentStop.Longitude) * progress;

    // Calculate a realistic heading (bearing) between stops
    const heading = calculateBearing(
      currentStop.Latitude,
      currentStop.Longitude,
      nextStop.Latitude,
      nextStop.Longitude
    );

    // Random speed between 0-50 km/h (realistic for urban buses)
    const speed = Math.floor(Math.random() * 50);

    // Generate a timestamp within the last 2 minutes
    const lastUpdated = new Date(Date.now() - Math.random() * 120000);
    const lastUpdatedStr = lastUpdated.toISOString();

    vehicles.push({
      BlockFareboxId: 9000 + i + routeId * 10,
      Destination: nextStop.Name,
      Direction: stopIndex < stops.length / 2 ? "Outbound" : "Inbound",
      DirectionLong: stopIndex < stops.length / 2 ? "Outbound Direction" : "Inbound Direction",
      DisplayStatus: "On Time",
      Heading: heading,
      LastStop: currentStop.Name,
      LastUpdated: lastUpdatedStr,
      Latitude: latitude,
      Longitude: longitude,
      Name: `Dev Bus ${routeId}-${i + 1}`,
      OccupancyStatusReportLabel: getRandomOccupancy(),
      RouteId: routeId,
      Speed: speed,
      VehicleId: 9000 + i + routeId * 10,
    });
  }

  return vehicles;
}

/**
 * Calculate bearing between two coordinates
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const toDegrees = (rad: number) => (rad * 180) / Math.PI;

  const dLon = toRadians(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);

  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Get a random occupancy status
 */
function getRandomOccupancy(): string {
  const statuses = [
    "Empty",
    "Many Seats Available",
    "Few Seats Available",
    "Standing Room Only",
    "Crowded",
    "Full",
  ];
  return statuses[Math.floor(Math.random() * statuses.length)] ?? "Unknown";
}

/**
 * Check if dev mode is enabled
 */
export function isDevMode(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if fake buses should be generated
 * Can be disabled by setting ENABLE_FAKE_BUSES=false even in development mode
 */
export function shouldUseFakeBuses(): boolean {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  
  // Allow explicit override via environment variable
  const enableFakeBuses = process.env.ENABLE_FAKE_BUSES;
  if (enableFakeBuses !== undefined) {
    return enableFakeBuses.toLowerCase() === "true";
  }
  
  // Default to true in development mode
  return true;
}
