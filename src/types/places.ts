/**
 * Shared place search types used across the application
 */

import type { LocationSearchResult } from "./location";

export interface PlaceResult {
  mapboxId: string;
  name: string;
  placeName: string;
  address?: string;
  context: string[];
  distanceMeters?: number;
  location?: LocationSearchResult;
}
