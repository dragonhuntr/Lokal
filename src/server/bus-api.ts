import { toast } from "sonner";

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
  StopId: number;  // Adding this back as it's needed for filtering
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

// Function to fetch and parse KML route data
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
    toast.error("Could not retrieve route data");
    return { name: "Error", paths: [] };
  }
};

// Function to parse KML text to RouteData
export const parseKmlToRouteData = (kmlText: string): RouteData => {
  try {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, "text/xml");

    // Get document name
    const docNameElement = kmlDoc.querySelector("Document > name");
    const docName = docNameElement ? docNameElement.textContent || "Unknown Route" : "Unknown Route";

    // Get all placemarks (line segments)
    const placemarks = kmlDoc.querySelectorAll("Placemark");
    const paths: RoutePath[] = [];

    placemarks.forEach((placemark) => {
      const nameElement = placemark.querySelector("name");
      const name = nameElement ? nameElement.textContent || "Unknown Path" : "Unknown Path";

      const coordinatesElement = placemark.querySelector("LineString > coordinates");
      if (!coordinatesElement?.textContent) return;

      const coordinatesText = coordinatesElement.textContent.trim();
      const coordinates: RouteCoordinate[] = coordinatesText
        .split(" ")
        .filter(coord => coord.trim().length > 0)
        .map(coordString => {
          const parts = coordString.split(",").map(Number);
          const longitude = parts[0] ?? 0;
          const latitude = parts[1] ?? 0;
          const altitude = parts[2] ?? 0;
          return { longitude, latitude, altitude };
        });

      paths.push({
        name,
        coordinates
      });
    });

    return {
      name: docName,
      paths
    };
  } catch (error) {
    console.error("Error parsing KML data:", error);
    return { name: "Error", paths: [] };
  }
};

export const fetchRoutes = async (): Promise<Route[]> => {
  try {
    const response = await fetch(
      'https://emta.availtec.com/InfoPoint/rest/Routes/GetVisibleRoutes'
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json() as Route[];
  } catch (error) {
    console.error("Error fetching routes:", error);
    toast.error("Could not retrieve routes");
    return [];
  }
};

// Cache for route details
let routeDetailsCache: Record<number, RouteDetails> = {};
let lastRouteDetailsFetchTime = 0;
const ROUTE_DETAILS_CACHE_LIFETIME = 30000; // 30 seconds since vehicle positions update frequently

export const fetchRouteDetails = async (routeId: number): Promise<RouteDetails> => {
  // If cache is fresh and we have this route, use it
  if (Date.now() - lastRouteDetailsFetchTime < ROUTE_DETAILS_CACHE_LIFETIME &&
      routeDetailsCache[routeId]) {
    return routeDetailsCache[routeId];
  }

  try {
    // Try to fetch all route details first
    const response = await fetch(
      'https://emta.availtec.com/InfoPoint/rest/RouteDetails/GetAllRouteDetails'
    );

    if (response.ok) {
      // If getAllRouteDetails works, cache all routes
      const allRoutes = await response.json() as RouteDetails[];
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
      // Fall back to single route fetch if getAllRouteDetails fails
      const singleResponse = await fetch(
        `https://emta.availtec.com/InfoPoint/rest/RouteDetails/Get/${routeId}`
      );

      if (!singleResponse.ok) {
        throw new Error(`API request failed with status ${singleResponse.status}`);
      }

      const routeDetails = await singleResponse.json() as RouteDetails;
      routeDetailsCache[routeId] = routeDetails;
      lastRouteDetailsFetchTime = Date.now();

      return routeDetails;
    }
  } catch (error) {
    console.error("Error fetching route details:", error);
    // If error occurs, return cached data if available
    if (routeDetailsCache[routeId]) {
      return routeDetailsCache[routeId];
    }
    throw error;
  }
};

// Cache for stop departures
let departuresCache: StopDepartureInfo[] = [];
let lastFetchTime = 0;
const CACHE_LIFETIME = 30000; // 30 seconds

// Start polling for departures
let pollingInterval: NodeJS.Timeout | null = null;

const startPolling = () => {
  if (pollingInterval) return; // Already polling

  const pollDepartures = async () => {
    try {
      const response = await fetch(
        `https://emta.availtec.com/InfoPoint/rest/stopdepartures/getallstopdepartures`
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      departuresCache = await response.json() as StopDepartureInfo[];
      lastFetchTime = Date.now();
    } catch (error) {
      console.error("Error fetching stop departures:", error);
    }
  };

  // Initial fetch
  void pollDepartures();

  // Set up polling interval
  pollingInterval = setInterval(() => void pollDepartures(), CACHE_LIFETIME);
};

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

export const fetchStopDepartures = async (stopId?: number): Promise<StopDepartureInfo[]> => {
  // Start polling if not already started
  startPolling();

  try {
    // Always use cached data if available, even if slightly stale
    if (departuresCache.length > 0) {
      if (stopId) {
        return departuresCache.filter((departure) => departure.StopId === stopId);
      }
      return departuresCache;
    }

    // Only fetch directly if no cache exists and polling hasn't populated it yet
    // This should rarely happen since startPolling() does an immediate fetch
    if (Date.now() - lastFetchTime > CACHE_LIFETIME * 2) {
      const response = await fetch(
        `https://emta.availtec.com/InfoPoint/rest/stopdepartures/getallstopdepartures`
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      departuresCache = await response.json() as StopDepartureInfo[];
      lastFetchTime = Date.now();
    }

    if (stopId) {
      return departuresCache.filter((departure) => departure.StopId === stopId);
    }

    return departuresCache;
  } catch (error) {
    console.error("Error fetching stop departures:", error);
    // If error occurs, return cached data if available, otherwise empty array
    if (departuresCache.length > 0) {
      if (stopId) {
        return departuresCache.filter((departure) => departure.StopId === stopId);
      }
      return departuresCache;
    }
    return [];
  }
};

// Cache for all stops
let stopsCache: Stop[] = [];
let lastStopsFetchTime = 0;
const STOPS_CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes, stops don't change often

export const fetchAllStops = async (): Promise<Stop[]> => {
  // If cache is fresh, use it
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

    stopsCache = await response.json() as Stop[];
    lastStopsFetchTime = Date.now();
    return stopsCache;
  } catch (error) {
    console.error("Error fetching all stops:", error);
    // If error occurs, return cached data if available, otherwise empty array
    if (stopsCache.length > 0) {
      return stopsCache;
    }
    return [];
  }
};

// Clean up function to stop polling
export const cleanup = () => {
  stopPolling();
};

// Function to format ETA
export const formatETA = (etaLocalTime: string): string => {
  try {
    const etaDate = new Date(etaLocalTime);
    const now = new Date();
    const diffMinutes = Math.round((etaDate.getTime() - now.getTime()) / 60000);

    if (diffMinutes <= 0) return 'Now';
    if (diffMinutes === 1) return '1 min';
    if (diffMinutes < 60) return `${diffMinutes} mins`;

    // For times more than an hour away, show the actual time
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
