/**
 * Base types and interfaces for departure data sources
 * Supports pluggable data sources with Strategy Pattern
 */

/**
 * Data source type indicator
 */
export enum DataSourceType {
  REALTIME = "realtime",     // Live API data from Availtec
  SCHEDULED = "scheduled",   // GTFS static schedule data
  ESTIMATED = "estimated",   // Estimated/calculated data
}

/**
 * Departure information with timing and source metadata
 */
export interface DepartureInfo {
  departureTime: Date;
  arrivalTime: Date | null;
  waitTimeMinutes: number;
  dataSource: DataSourceType;
  tripId?: string;
}

/**
 * Base interface for departure data sources
 * Implementations: RealtimeDataSource, GTFSDataSource
 */
export interface DepartureDataSource {
  /**
   * Get the next available departure for a specific stop and route
   * @param stopId Stop numeric ID
   * @param routeId Route numeric ID
   * @param requestedDepartureTime Requested departure time
   * @returns Departure info or null if no departures available
   */
  getNextDeparture(
    stopId: number,
    routeId: number,
    requestedDepartureTime: Date
  ): Promise<DepartureInfo | null>;
}

/**
 * Reason why a data source couldn't provide departure information
 */
export enum FallbackReason {
  NO_DATA = "no_data",                       // Data source returned no data
  EMPTY_RESPONSE = "empty_response",         // Data source returned empty response
  FUTURE_TIME = "future_time",               // Requested time is beyond data source capability
  ERROR = "error",                           // Error occurred while fetching
  NO_ACTIVE_BUSES = "no_active_buses",       // No active buses for this route
  INVALID_IDS = "invalid_ids",               // Invalid stop or route IDs
}
