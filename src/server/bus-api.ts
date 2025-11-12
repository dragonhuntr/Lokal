import { z } from "zod";

import { db } from "@/server/db";
import { generateFakeBuses, shouldUseFakeBuses } from "@/server/dev-bus-data";
import { getCached, getCachedWithJitter, getCachedBatch } from "@/lib/redis";
import { CACHE_KEYS, CACHE_TTL } from "@/lib/cache-keys";

// Log dev mode status on module load
if (shouldUseFakeBuses()) {
  console.log("[DEV MODE] ✅ Fake buses enabled - NODE_ENV:", process.env.NODE_ENV);
} else {
  console.log("[PROD MODE] Using real bus data - NODE_ENV:", process.env.NODE_ENV);
}

export interface RouteCoordinate {
  longitude: number;
  latitude: number;
  altitude: number;
}

export interface RoutePath {
  name: string;
  coordinates: RouteCoordinate[];
}

export interface RouteData {
  name: string;
  paths: RoutePath[];
}

export interface RouteDetails {
  Color: string;
  Directions: {
    Dir: string;
    DirectionDesc: string | null;
    DirectionIconFileName: string | null;
  }[];
  GoogleDescription: string;
  LongName: string;
  RouteAbbreviation: string;
  RouteId: number;
  ShortName: string;
  RouteTraceFilename: string;
  Stops: {
    Description: string;
    IsTimePoint: boolean;
    Latitude: number;
    Longitude: number;
    Name: string;
    StopId: number;
    StopRecordId: number;
  }[];
  Vehicles: {
    BlockFareboxId: number;
    Destination: string;
    Direction: string;
    DirectionLong: string;
    DisplayStatus: string;
    Heading: number;
    LastStop: string;
    LastUpdated: string;
    Latitude: number;
    Longitude: number;
    Name: string;
    OccupancyStatusReportLabel: string;
    RouteId: number;
    Speed: number;
    VehicleId: number;
  }[];
}

export interface Route {
  RouteId: number;
  ShortName: string;
  LongName: string;
  Description: string;
  Color: string;
  TextColor: string;
  IsVisible: boolean;
}

export interface Trip {
  BlockFareboxId: number;
  GtfsTripId: string;
  InternalSignDesc: string;
  InternetServiceDesc: string;
  IVRServiceDesc: string;
  StopSequence: number;
  TripDirection: string;
  TripId: number;
  TripRecordId: number;
  TripStartTime: string;
  TripStartTimeLocalTime: string;
  TripStatus: number;
  TripStatusReportLabel: string;
}

export interface StopDeparture {
  ADT: string | null;
  ADTLocalTime: string | null;
  ATA: string | null;
  ATALocalTime: string | null;
  Bay: string | null;
  Dev: string;
  EDT: string;
  EDTLocalTime: string;
  ETA: string;
  ETALocalTime: string;
  IsCompleted: boolean;
  IsLastStopOnTrip: boolean;
  LastUpdated: string;
  LastUpdatedLocalTime: string;
  Mode: number;
  ModeReportLabel: string;
  PropogationStatus: number;
  SDT: string;
  SDTLocalTime: string;
  STA: string;
  STALocalTime: string;
  StopFlag: number;
  StopStatus: number;
  StopStatusReportLabel: string;
  Trip: Trip;
  PropertyName: string;
}

export interface HeadwayDeparture {
  HeadwayIntervalScheduled: string;
  HeadwayIntervalTarget: string;
  LastDeparture: string;
  LastUpdated: string;
  NextDeparture: string;
  VehicleId: string;
}

export interface RouteDirection {
  Direction: string;
  DirectionCode: string;
  RouteId: string;
  RouteRecordId: number;
  Departures: StopDeparture[];
  HeadwayDepartures: HeadwayDeparture[] | null;
  IsDone: boolean;
  IsHeadway: boolean;
  IsHeadwayMonitored: boolean;
}

export interface StopDepartureInfo {
  LastUpdated: string;
  StopId: number;
  RouteDirections: RouteDirection[];
}

export interface Stop {
  Description: string;
  IsTimePoint: boolean;
  Latitude: number;
  Longitude: number;
  Name: string;
  StopId: number;
  StopRecordId: number;
}

// fetch and parse KML route data
export const fetchRouteKML = async (routeId: number): Promise<RouteData> => {
  try {
    const response = await fetch(
      `https://emta.availtec.com/InfoPoint/Resources/Traces/Route${routeId}.kml`
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const kmlText = await response.text();
    return parseKmlToRouteData(kmlText);
  } catch (error) {
    console.error("Error fetching route data:", error);
    return { name: "Error", paths: [] };
  }
};

// parse KML text to RouteData
export const parseKmlToRouteData = (kmlText: string): RouteData => {
  try {
    // Document name
    const nameMatch = /<Document>\s*<name>([^<]*)<\/name>/i.exec(kmlText);
    const docName = nameMatch?.[1] ?? "Unknown Route";

    // Extract each Placemark
    const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
    const paths: RoutePath[] = [];
    const placemarks: string[] = [];
    {
      let m: RegExpExecArray | null;
      while ((m = placemarkRegex.exec(kmlText)) !== null) {
        placemarks.push(m[0]);
      }
    }

    for (const placemark of placemarks) {
      const nameMatchInner = /<name>([^<]*)<\/name>/i.exec(placemark);
      const name = nameMatchInner?.[1] ?? "Unknown Path";
      const coordsMatch = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(placemark);
      const coordsText = coordsMatch?.[1]?.trim() ?? "";
      if (!coordsText) continue;

      const coordinates: RouteCoordinate[] = coordsText
        .split(/\s+/)
        .filter(Boolean)
        .map((coord) => {
          const [lngStr, latStr, altStr] = coord.split(",");
          const longitude = Number(lngStr ?? 0);
          const latitude = Number(latStr ?? 0);
          const altitude = Number(altStr ?? 0);
          return { longitude, latitude, altitude };
        });

      paths.push({ name, coordinates });
    }

    return { name: docName, paths };
  } catch (error) {
    console.error("Error parsing KML data:", error);
    return { name: "Error", paths: [] };
  }
};

export const fetchRoutes = async (): Promise<Route[]> => {
  try {
    // Use Redis cache with cache-aside pattern
    return await getCached<Route[]>(
      CACHE_KEYS.ROUTES,
      async () => {
        const response = await fetch(
          'https://emta.availtec.com/InfoPoint/rest/Routes/GetVisibleRoutes',
          { headers: { Accept: 'application/json' }, cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const RawRouteSchema = z.object({
          RouteId: z.coerce.number(),
          ShortName: z.coerce.string(),
          LongName: z.coerce.string().optional().default(""),
          Description: z.union([z.string(), z.null()]).optional(),
          Color: z.coerce.string().optional().default(""),
          TextColor: z.coerce.string().optional().default(""),
          IsVisible: z.preprocess((v) => {
            if (typeof v === 'boolean') return v;
            if (typeof v === 'number') return v !== 0;
            if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
            return false;
          }, z.boolean()).optional().default(true),
        }).passthrough();

        const json: unknown = await response.json();
        const parsed = z.array(RawRouteSchema).parse(json);

        const toHex = (str: string) => {
          const s = str.trim();
          return s.startsWith('#') ? s.slice(1) : s;
        };

        const routes: Route[] = parsed.map((r) => ({
          RouteId: r.RouteId,
          ShortName: r.ShortName,
          LongName: r.LongName ?? "",
          Description: typeof r.Description === 'string' ? r.Description : "",
          Color: toHex(r.Color ?? ""),
          TextColor: toHex(r.TextColor ?? ""),
          IsVisible: r.IsVisible ?? true,
        }));

        return routes;
      },
      CACHE_TTL.ROUTES
    );
  } catch (error) {
    console.error("Error fetching routes:", error);
    return [];
  }
};

export const fetchRouteDetails = async (routeId: number): Promise<RouteDetails> => {
  // Use Redis cache with cache-aside pattern
  return await getCached<RouteDetails>(
    CACHE_KEYS.ROUTE_DETAILS(routeId),
    async () => {
      // Fetch from Availtec API for complete route details including vehicles
      try {
        const response = await fetch(
          `https://emta.availtec.com/InfoPoint/rest/RouteDetails/Get/${routeId}`,
          { headers: { Accept: 'application/json' }, cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error(`Availtec API request failed with status ${response.status}`);
        }

        const data = (await response.json()) as RouteDetails;

        // In dev mode, replace with fake buses for testing (if enabled)
        if (shouldUseFakeBuses()) {
          console.log(`[DEV MODE] fetchRouteDetails - Route ${routeId}: ${data.Stops?.length ?? 0} stops, ${data.Vehicles?.length ?? 0} real buses`);
          data.Vehicles = generateFakeBuses({
            routeId,
            stops: data.Stops,
            color: data.Color,
          });
          console.log(`[DEV MODE] Generated ${data.Vehicles.length} fake buses for route ${routeId}`);
        }

        return data;
      } catch (error) {
        console.error(`Error fetching route details from Availtec for route ${routeId}:`, error);

        // Fallback to database if Availtec fails
        try {
          const route = await db.route.findUnique({
            where: { id: `route-${routeId}` },
            include: {
              stops: {
                orderBy: { sequence: "asc" },
              },
            },
          });

          if (!route) {
            throw new Error(`Route ${routeId} not found in database or Availtec API`);
          }

          const stops: RouteDetails["Stops"] = route.stops.map((stop) => ({
            Description: stop.name,
            IsTimePoint: true,
            Latitude: stop.latitude,
            Longitude: stop.longitude,
            Name: stop.name,
            StopId: stop.sequence,
            StopRecordId: stop.sequence,
          }));

          // In dev mode, generate fake buses for testing (if enabled)
          const vehicles = shouldUseFakeBuses()
            ? generateFakeBuses({
                routeId,
                stops,
              })
            : ([] as RouteDetails["Vehicles"]);

          const result: RouteDetails = {
            Color: "",
            Directions: [] as RouteDetails["Directions"],
            GoogleDescription: "",
            LongName: route.name,
            RouteAbbreviation: route.number,
            RouteId: routeId,
            ShortName: route.number,
            RouteTraceFilename: "",
            Stops: stops,
            Vehicles: vehicles,
          };

          return result;
        } catch (dbError) {
          throw new Error(`Failed to fetch route ${routeId} from both Availtec API and database: ${String(dbError)}`);
        }
      }
    },
    CACHE_TTL.ROUTE_DETAILS
  );
};

// Zod schemas for departure data validation
const TripSchema = z.object({
  BlockFareboxId: z.number(),
  GtfsTripId: z.string(),
  InternalSignDesc: z.string(),
  InternetServiceDesc: z.string(),
  IVRServiceDesc: z.string(),
  StopSequence: z.number(),
  TripDirection: z.string(),
  TripId: z.number(),
  TripRecordId: z.number(),
  TripStartTime: z.string(),
  TripStartTimeLocalTime: z.string(),
  TripStatus: z.number(),
  TripStatusReportLabel: z.string(),
});

const StopDepartureSchema = z.object({
  ADT: z.string().nullable(),
  ADTLocalTime: z.string().nullable(),
  ATA: z.string().nullable(),
  ATALocalTime: z.string().nullable(),
  Bay: z.string().nullable(),
  Dev: z.string(),
  EDT: z.string(),
  EDTLocalTime: z.string(),
  ETA: z.string(),
  ETALocalTime: z.string(),
  IsCompleted: z.boolean(),
  IsLastStopOnTrip: z.boolean(),
  LastUpdated: z.string(),
  LastUpdatedLocalTime: z.string(),
  Mode: z.number(),
  ModeReportLabel: z.string(),
  PropogationStatus: z.number(),
  SDT: z.string(),
  SDTLocalTime: z.string(),
  STA: z.string(),
  STALocalTime: z.string(),
  StopFlag: z.number(),
  StopStatus: z.number(),
  StopStatusReportLabel: z.string(),
  Trip: TripSchema,
  PropertyName: z.string(),
});

const HeadwayDepartureSchema = z.object({
  HeadwayIntervalScheduled: z.string(),
  HeadwayIntervalTarget: z.string(),
  LastDeparture: z.string(),
  LastUpdated: z.string(),
  NextDeparture: z.string(),
  VehicleId: z.string(),
});

const RouteDirectionSchema = z.object({
  Direction: z.string(),
  DirectionCode: z.string(),
  RouteId: z.coerce.string(),
  RouteRecordId: z.number(),
  Departures: z.array(StopDepartureSchema),
  HeadwayDepartures: z.array(HeadwayDepartureSchema).nullable(),
  IsDone: z.boolean(),
  IsHeadway: z.boolean(),
  IsHeadwayMonitored: z.boolean(),
});

const StopDepartureInfoSchema = z.object({
  LastUpdated: z.string(),
  StopId: z.number(),
  RouteDirections: z.array(RouteDirectionSchema),
});

export const fetchStopDepartures = async (stopId?: number): Promise<StopDepartureInfo[]> => {
  try {
    // Use Redis cache with cache-aside pattern
    const allDepartures = await getCached<StopDepartureInfo[]>(
      CACHE_KEYS.DEPARTURES,
      async () => {
        const response = await fetch(
          `https://emta.availtec.com/InfoPoint/rest/stopdepartures/getallstopdepartures`
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const json: unknown = await response.json();
        return z.array(StopDepartureInfoSchema).parse(json);
      },
      CACHE_TTL.DEPARTURES
    );

    // Filter by stopId if provided
    if (stopId) {
      return allDepartures.filter((departure) => departure.StopId === stopId);
    }

    return allDepartures;
  } catch (error) {
    console.error("Error fetching stop departures:", error);
    return [];
  }
};

export const fetchAllStops = async (): Promise<Stop[]> => {
  try {
    // Use Redis cache with cache-aside pattern
    return await getCached<Stop[]>(
      CACHE_KEYS.STOPS,
      async () => {
        const response = await fetch(
          'https://emta.availtec.com/InfoPoint/rest/stops/getallstops'
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const StopSchema = z.object({
          Description: z.string(),
          IsTimePoint: z.boolean(),
          Latitude: z.number(),
          Longitude: z.number(),
          Name: z.string(),
          StopId: z.number(),
          StopRecordId: z.number(),
        });

        const json: unknown = await response.json();
        return z.array(StopSchema).parse(json);
      },
      CACHE_TTL.STOPS
    );
  } catch (error) {
    console.error("Error fetching all stops:", error);
    return [];
  }
};

// cleanup is now handled by redis.ts
export const cleanup = () => {
  // Redis cleanup is handled automatically in redis.ts
};

// function to format ETA
export const formatETA = (etaLocalTime: string): string => {
  try {
    const etaDate = new Date(etaLocalTime);
    const now = new Date();
    const diffMinutes = Math.round((etaDate.getTime() - now.getTime()) / 60000);

    if (diffMinutes <= 0) return 'Now';
    if (diffMinutes === 1) return '1 min';
    if (diffMinutes < 60) return `${diffMinutes} mins`;

    // for times more than an hour away, show the actual time
    return etaDate.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch (error) {
    console.error("Error parsing ETA:", error);
    return 'Unknown';
  }
};

export const formatLastUpdated = (lastUpdatedStr: string): string => {
  try {
    const date = new Date(lastUpdatedStr);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.error("Error parsing date:", error);
    return "Unknown";
  }
};

export const fetchAllVehicles = async (): Promise<RouteDetails["Vehicles"]> => {
  try {
    // Use Redis cache with jittered TTL to prevent thundering herd
    return await getCachedWithJitter<RouteDetails["Vehicles"]>(
      CACHE_KEYS.VEHICLES,
      async () => {
        const routes = await fetchRoutes();

        // Optimize: Batch fetch all route details from Redis at once
        const routeKeys = routes.map((route) => CACHE_KEYS.ROUTE_DETAILS(route.RouteId));
        const cachedRouteDetails = await getCachedBatch<RouteDetails>(routeKeys);

        // Process routes: use cached data if available, otherwise fetch individually
        const vehiclePromises = routes.map(async (route) => {
          try {
            const cacheKey = CACHE_KEYS.ROUTE_DETAILS(route.RouteId);
            let routeDetails = cachedRouteDetails.get(cacheKey);

            // If cache miss, fetch individually
            if (!routeDetails) {
              routeDetails = await fetchRouteDetails(route.RouteId);
            }

            if (routeDetails?.Vehicles && routeDetails.Vehicles.length > 0) {
              // Filter out invalid coordinates
              return routeDetails.Vehicles.filter(
                (vehicle) =>
                  Number.isFinite(vehicle.Latitude) &&
                  Number.isFinite(vehicle.Longitude) &&
                  (vehicle.Latitude !== 0 || vehicle.Longitude !== 0)
              );
            }
            return [];
          } catch (error) {
            console.error(`Error fetching vehicles for route ${route.RouteId}:`, error);
            // Return empty array for failed routes instead of breaking the whole operation
            return [];
          }
        });

        // Wait for all parallel requests to complete
        const vehicleArrays = await Promise.all(vehiclePromises);
        return vehicleArrays.flat();
      },
      CACHE_TTL.VEHICLES,
      20  // 20% jitter for frequently updated data
    );
  } catch (error) {
    console.error("Error fetching all vehicles:", error);
    return [];
  }
};

// Re-export utility functions for backward compatibility
export { getOccupancyLabel, getOccupancyColor } from "@/lib/bus-utils";
