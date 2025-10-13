import { z } from "zod";

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

// cache for route details
let routeDetailsCache: Record<number, RouteDetails> = {};
let lastRouteDetailsFetchTime = 0;
const ROUTE_DETAILS_CACHE_LIFETIME = 30000; //can decrease this

export const fetchRouteDetails = async (routeId: number): Promise<RouteDetails> => {
  // if cache is fresh and we have this route, use it
  if (Date.now() - lastRouteDetailsFetchTime < ROUTE_DETAILS_CACHE_LIFETIME &&
      routeDetailsCache[routeId]) {
    return routeDetailsCache[routeId];
  }

  try {
    // try to fetch all route details first
    const response = await fetch(
      'https://emta.availtec.com/InfoPoint/rest/RouteDetails/GetAllRouteDetails'
    );

    if (response.ok) {
      // if getAllRouteDetails works, cache all routes
      const VehicleSchema = z.object({
        BlockFareboxId: z.number(),
        Destination: z.string(),
        Direction: z.string(),
        DirectionLong: z.string(),
        DisplayStatus: z.string(),
        Heading: z.number(),
        LastStop: z.string(),
        LastUpdated: z.string(),
        Latitude: z.number(),
        Longitude: z.number(),
        Name: z.string(),
        OccupancyStatusReportLabel: z.string(),
        RouteId: z.number(),
        Speed: z.number(),
        VehicleId: z.number(),
      });
      const StopSchema = z.object({
        Description: z.string(),
        IsTimePoint: z.boolean(),
        Latitude: z.number(),
        Longitude: z.number(),
        Name: z.string(),
        StopId: z.number(),
        StopRecordId: z.number(),
      });
      const DirectionSchema = z.object({
        Dir: z.string(),
        DirectionDesc: z.string().nullable(),
        DirectionIconFileName: z.string().nullable(),
      });
      const RouteDetailsSchema = z.object({
        Color: z.string(),
        Directions: z.array(DirectionSchema),
        GoogleDescription: z.string(),
        LongName: z.string(),
        RouteAbbreviation: z.string(),
        RouteId: z.number(),
        ShortName: z.string(),
        RouteTraceFilename: z.string(),
        Stops: z.array(StopSchema),
        Vehicles: z.array(VehicleSchema),
      });
      const json: unknown = await response.json();
      const allRoutes = z.array(RouteDetailsSchema).parse(json);
      routeDetailsCache = allRoutes.reduce((acc: Record<number, RouteDetails>, route: RouteDetails) => {
        acc[route.RouteId] = route;
        return acc;
      }, {});
      lastRouteDetailsFetchTime = Date.now();

      if (!routeDetailsCache[routeId]) {
        throw new Error(`Route ${routeId} not found in fetched route details`);
      }

      return routeDetailsCache[routeId];
    } else {
      // fall back to single route fetch if getAllRouteDetails fails
      const singleResponse = await fetch(
        `https://emta.availtec.com/InfoPoint/rest/RouteDetails/Get/${routeId}`
      );

      if (!singleResponse.ok) {
        throw new Error(`API request failed with status ${singleResponse.status}`);
      }

      const json: unknown = await singleResponse.json();
      const VehicleSchema = z.object({
        BlockFareboxId: z.number(),
        Destination: z.string(),
        Direction: z.string(),
        DirectionLong: z.string(),
        DisplayStatus: z.string(),
        Heading: z.number(),
        LastStop: z.string(),
        LastUpdated: z.string(),
        Latitude: z.number(),
        Longitude: z.number(),
        Name: z.string(),
        OccupancyStatusReportLabel: z.string(),
        RouteId: z.number(),
        Speed: z.number(),
        VehicleId: z.number(),
      });
      const StopSchema = z.object({
        Description: z.string(),
        IsTimePoint: z.boolean(),
        Latitude: z.number(),
        Longitude: z.number(),
        Name: z.string(),
        StopId: z.number(),
        StopRecordId: z.number(),
      });
      const DirectionSchema = z.object({
        Dir: z.string(),
        DirectionDesc: z.string().nullable(),
        DirectionIconFileName: z.string().nullable(),
      });
      const RouteDetailsSchema = z.object({
        Color: z.string(),
        Directions: z.array(DirectionSchema),
        GoogleDescription: z.string(),
        LongName: z.string(),
        RouteAbbreviation: z.string(),
        RouteId: z.number(),
        ShortName: z.string(),
        RouteTraceFilename: z.string(),
        Stops: z.array(StopSchema),
        Vehicles: z.array(VehicleSchema),
      });
      const routeDetails = RouteDetailsSchema.parse(json);
      routeDetailsCache[routeId] = routeDetails;
      lastRouteDetailsFetchTime = Date.now();

      return routeDetails;
    }
  } catch (error) {
    console.error("Error fetching route details:", error);
    // if error occurs, return cached data if available
    if (routeDetailsCache[routeId]) {
      return routeDetailsCache[routeId];
    }
    throw error;
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
        RouteId: z.string(),
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
        RouteId: z.string(),
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

export const getOccupancyLabel = (status: string): string => {
  switch (status.toLowerCase()) {
    case "empty":
      return "Empty";
    case "many seats available":
      return "Many Seats";
    case "few seats available":
      return "Few Seats";
    case "standing room only":
      return "Standing Room";
    case "crushed standing room only":
      return "Full";
    case "not accepting passengers":
      return "Full";
    default:
      return status;
  }
};

export const getOccupancyColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "empty":
      return "bg-green-100 text-green-800";
    case "many seats available":
      return "bg-green-100 text-green-800";
    case "few seats available":
      return "bg-yellow-100 text-yellow-800";
    case "standing room only":
      return "bg-orange-100 text-orange-800";
    case "crushed standing room only":
      return "bg-red-100 text-red-800";
    case "not accepting passengers":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};
