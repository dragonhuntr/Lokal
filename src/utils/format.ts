/**
 * Shared formatting utilities for time and distance
 */

/**
 * Format a duration in minutes to a human-readable string
 * @param value Duration in minutes
 * @returns Formatted string (e.g., "5 mins", "1h 30m")
 */
export function formatMinutes(value: number): string {
  const rounded = Math.round(value);
  if (rounded <= 0) return "<1 min";
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
}

/**
 * Format a duration in minutes for sharing messages
 * Always shows at least 1 minute, never "<1 min"
 * @param value Duration in minutes
 * @returns Formatted string (e.g., "5 minutes", "1 minute")
 */
export function formatShareMinutes(value: number): string {
  const rounded = Math.max(1, Math.round(value));
  return `${rounded} minute${rounded === 1 ? "" : "s"}`;
}

/**
 * Format a duration in minutes to hours and minutes format
 * @param minutes Duration in minutes
 * @returns Formatted string (e.g., "30 min", "1h 30m", "2h")
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format a distance in meters to a human-readable string
 * @param distanceMeters Distance in meters
 * @returns Formatted string (e.g., "500 m", "1.2 km")
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  const kilometres = distanceMeters / 1000;
  const decimals = kilometres >= 10 ? 0 : 1;
  return `${kilometres.toFixed(decimals)} km`;
}

/**
 * Format a Date object or ISO string to a localized time string
 * @param date Date object or ISO string
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "Invalid time";
  return dateObj.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
