import { readFileSync } from 'fs';
import { join } from 'path';

export interface GTFSRoute {
  route_id: string;
  agency_id: string;
  route_short_name: string;
  route_long_name: string;
  route_desc: string;
  route_type: string;
  route_url: string;
  route_color: string;
  route_text_color: string;
  route_sort_order: string;
}

export interface GTFSStop {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  stop_desc: string;
  stop_lat: string;
  stop_lon: string;
  zone_id: string;
  stop_url: string;
  location_type: string;
  parent_station: string;
  wheelchair_boarding: string;
}

export interface GTFSTrip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign: string;
  direction_id: string;
  block_id: string;
  shape_id: string;
  wheelchair_accessible: string;
  bikes_allowed: string;
}

export interface GTFSStopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
  stop_headsign: string;
  pickup_type: string;
  drop_off_type: string;
  shape_dist_traveled: string;
  timepoint: string;
}

export interface GTFSCalendarDate {
  service_id: string;
  date: string;
  exception_type: string;
}

/**
 * Parse a GTFS CSV file
 * @param filePath Path to the CSV file
 * @returns Array of parsed objects
 */
export function parseCSV<T>(filePath: string): T[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length === 0) {
    return [];
  }

  // First line is the header
  const headers = lines[0].split(',').map(h => h.trim());

  const results: T[] = [];

  // Parse each line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVLine(line);
    const obj: any = {};

    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || '';
    }

    results.push(obj as T);
  }

  return results;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  result.push(current.trim());

  return result;
}

/**
 * Parse all GTFS files from a directory
 */
export function parseGTFSDirectory(gtfsDir: string) {
  return {
    routes: parseCSV<GTFSRoute>(join(gtfsDir, 'routes.txt')),
    stops: parseCSV<GTFSStop>(join(gtfsDir, 'stops.txt')),
    trips: parseCSV<GTFSTrip>(join(gtfsDir, 'trips.txt')),
    stopTimes: parseCSV<GTFSStopTime>(join(gtfsDir, 'stop_times.txt')),
    calendarDates: parseCSV<GTFSCalendarDate>(join(gtfsDir, 'calendar_dates.txt')),
  };
}

/**
 * Parse GTFS time format (can be > 24 hours like 25:30:00)
 * @param timeStr GTFS time string (e.g., "14:30:00" or "25:30:00")
 * @returns Object with hours, minutes, seconds
 */
export function parseGTFSTime(timeStr: string): { hours: number; minutes: number; seconds: number } {
  const parts = timeStr.split(':');
  return {
    hours: parseInt(parts[0], 10),
    minutes: parseInt(parts[1], 10),
    seconds: parseInt(parts[2], 10),
  };
}

/**
 * Convert GTFS time to minutes since midnight
 * Handles times > 24 hours (next day)
 */
export function gtfsTimeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseGTFSTime(timeStr);
  return hours * 60 + minutes;
}

/**
 * Convert GTFS time string to a Date object
 * Handles GTFS times > 24 hours (e.g., "25:30:00" = next day 1:30 AM)
 * GTFS times are in the transit agency's local timezone, not UTC
 * @param gtfsTime GTFS time string (e.g., "14:30:00" or "25:30:00")
 * @param baseDate Base date to apply the time to (should be normalized to local midnight)
 * @returns Date object with the GTFS time applied in local timezone
 */
export function gtfsTimeToDate(gtfsTime: string, baseDate: Date): Date {
  const { hours, minutes, seconds } = parseGTFSTime(gtfsTime);
  const date = new Date(baseDate);

  // Handle times >= 24 hours (next day)
  // Use local timezone methods since GTFS times are in local time
  if (hours >= 24) {
    date.setHours(hours - 24, minutes, seconds || 0, 0);
    date.setDate(date.getDate() + 1);
  } else {
    date.setHours(hours, minutes, seconds || 0, 0);
  }

  return date;
}

/**
 * Parse GTFS date format (YYYYMMDD)
 */
export function parseGTFSDate(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);
  return new Date(year, month - 1, day);
}
