import { z } from "zod";

import { db } from "@/server/db";
import { generateFakeBuses, isDevMode } from "@/server/dev-bus-data";

// Log dev mode status on module load
if (isDevMode()) {
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
  } catch (error) {
    console.error("Error fetching routes:", error);
    return [];
  }
};

export const fetchRouteDetails = async (routeId: number): Promise<RouteDetails> => {
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

    // In dev mode, replace with fake buses for testing
    if (isDevMode()) {
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

      // In dev mode, generate fake buses for testing
      const vehicles = isDevMode()
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
};

// cache for stop departures
let departuresCache: StopDepartureInfo[] = [];
let lastFetchTime = 0;
const CACHE_LIFETIME = 30000; //can decrease this

// Start polling for departures
let pollingInterval: NodeJS.Timeout | null = null;

const startPolling = () => {
  if (pollingInterval) return; // already polling

  const pollDepartures = async () => {
    try {
      const response = await fetch(
        `https://emta.availtec.com/InfoPoint/rest/stopdepartures/getallstopdepartures`
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

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
      const json: unknown = await response.json();
      departuresCache = z.array(StopDepartureInfoSchema).parse(json);
      lastFetchTime = Date.now();
    } catch (error) {
      console.error("Error fetching stop departures:", error);
    }
  };

  // initial fetch
  void pollDepartures();

  // set up polling interval
  pollingInterval = setInterval(() => void pollDepartures(), CACHE_LIFETIME);
};

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

export const fetchStopDepartures = async (stopId?: number): Promise<StopDepartureInfo[]> => {
  // start polling if not already started
  startPolling();

  try {
    // always use cached data if available, even if slightly stale
    if (departuresCache.length > 0) {
      if (stopId) {
        return departuresCache.filter((departure) => departure.StopId === stopId);
      }
      return departuresCache;
    }

    // only fetch directly if no cache exists and polling hasn't populated it yet
    // This should rarely happen since startPolling() does an immediate fetch
    if (Date.now() - lastFetchTime > CACHE_LIFETIME * 2) {
      const response = await fetch(
        `https://emta.availtec.com/InfoPoint/rest/stopdepartures/getallstopdepartures`
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

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
      const json: unknown = await response.json();
      departuresCache = z.array(StopDepartureInfoSchema).parse(json);
      lastFetchTime = Date.now();
    }

    if (stopId) {
      return departuresCache.filter((departure) => departure.StopId === stopId);
    }

    return departuresCache;
  } catch (error) {
    console.error("Error fetching stop departures:", error);
    // if error occurs, return cached data if available, otherwise empty array
    if (departuresCache.length > 0) {
      if (stopId) {
        return departuresCache.filter((departure) => departure.StopId === stopId);
      }
      return departuresCache;
    }
    return [];
  }
};

// cache for all stops
let stopsCache: Stop[] = [];
let lastStopsFetchTime = 0;
const STOPS_CACHE_LIFETIME = 5 * 60 * 1000; //can decrease this

export const fetchAllStops = async (): Promise<Stop[]> => {
  // if cache is fresh, use it
  if (Date.now() - lastStopsFetchTime < STOPS_CACHE_LIFETIME && stopsCache.length > 0) {
    return stopsCache;
  }

  try {
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
    stopsCache = z.array(StopSchema).parse(json);
    lastStopsFetchTime = Date.now();
    return stopsCache;
  } catch (error) {
    console.error("Error fetching all stops:", error);
    // if error occurs, return cached data if available, otherwise empty array
    if (stopsCache.length > 0) {
      return stopsCache;
    }
    return [];
  }
};

// clean up function to stop polling
export const cleanup = () => {
  stopPolling();
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

// cache for all vehicles
let vehiclesCache: RouteDetails["Vehicles"] = [];
let lastVehiclesFetchTime = 0;
const VEHICLES_CACHE_LIFETIME = 10000; // 10 seconds

export const fetchAllVehicles = async (): Promise<RouteDetails["Vehicles"]> => {
  // if cache is fresh, use it
  if (Date.now() - lastVehiclesFetchTime < VEHICLES_CACHE_LIFETIME && vehiclesCache.length > 0) {
    return vehiclesCache;
  }

  try {
    const routes = await fetchRoutes();
    const allVehicles: RouteDetails["Vehicles"] = [];

    // Fetch vehicle data for all visible routes
    for (const route of routes) {
      try {
        const routeDetails = await fetchRouteDetails(route.RouteId);
        if (routeDetails.Vehicles && routeDetails.Vehicles.length > 0) {
          // Filter out invalid coordinates
          const validVehicles = routeDetails.Vehicles.filter(
            (vehicle) =>
              Number.isFinite(vehicle.Latitude) &&
              Number.isFinite(vehicle.Longitude) &&
              (vehicle.Latitude !== 0 || vehicle.Longitude !== 0)
          );
          allVehicles.push(...validVehicles);
        }
      } catch (error) {
        console.error(`Error fetching vehicles for route ${route.RouteId}:`, error);
      }
    }

    vehiclesCache = allVehicles;
    lastVehiclesFetchTime = Date.now();
    return allVehicles;
  } catch (error) {
    console.error("Error fetching all vehicles:", error);
    // if error occurs, return cached data if available, otherwise empty array
    if (vehiclesCache.length > 0) {
      return vehiclesCache;
    }
    return [];
  }
};

// Re-export utility functions for backward compatibility
export { getOccupancyLabel, getOccupancyColor } from "@/lib/bus-utils";
