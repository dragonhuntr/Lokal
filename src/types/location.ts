/**
 * Shared location types used across the application
 */

export interface LocationSearchResult {
  id: string;
  name: string;
  placeName: string;
  latitude: number;
  longitude: number;
  address?: string;
  context: string[];
  bufferMinutes?: number;
  purpose?: string;
}

export type Coordinates = { latitude: number; longitude: number };
