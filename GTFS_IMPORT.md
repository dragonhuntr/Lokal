# GTFS Schedule Data Import

This document explains how to import and use the EMTA GTFS (General Transit Feed Specification) schedule data.

## Overview

The GTFS import system allows you to import static schedule data from the EMTA transit feed into your PostgreSQL database. This enables fast lookup of scheduled departure times without relying solely on real-time APIs.

## Database Schema

The import creates the following tables:

- **Service**: Transit service patterns (e.g., weekday, weekend, special)
- **ServiceDate**: Which dates each service runs
- **Trip**: Individual trip instances with route, direction, and headsign
- **StopTime**: Actual departure/arrival times for each stop on each trip

## Importing GTFS Data

### Prerequisites

1. GTFS files should be in the `/google_transit` directory
2. Database should be set up and migrations applied

### Running the Import

```bash
bun run prisma/seed-gtfs.ts
```

This will:
1. Parse all GTFS CSV files
2. Import services and calendar dates (127 dates for 3 services)
3. Update routes with GTFS data (29 routes)
4. Import stops (1,291 stops)
5. Import trips (1,657 trips)
6. Import stop times (62,543 departure/arrival times)

The import process uses batch inserts for efficiency and takes about 1-2 minutes.

## Database Summary

After import, you'll have:
- **3 Services** (Service IDs: 39, 43, 45)
- **127 Service Dates** (covering January-June 2026)
- **29 Routes**
- **1,291 Stops**
- **1,657 Trips**
- **62,543 Stop Times**

## API Usage

### 1. Get Scheduled Departures for a Stop

```typescript
// Using tRPC
const departures = await trpc.bus.getScheduledDepartures.query({
  stopNumericId: 100, // Yorktown Center
  date: new Date('2026-01-10'), // Optional, defaults to today
  afterTime: '10:00', // Optional, filter departures after this time
  limit: 20, // Optional, defaults to 20
});
```

Response:
```typescript
[
  {
    tripId: "t1B3-b17D9-sl2B",
    routeId: "clx...",
    routeName: "Frontier",
    routeNumber: "31",
    headsign: "W.4 - W 12 - AIRPORT",
    departureTime: "10:37:00",
    arrivalTime: "10:37:00",
    stopSequence: 1337,
    isTimepoint: false,
    directionId: 0,
    serviceId: 39
  },
  // ... more departures
]
```

### 2. Get Route Departures at a Specific Stop

```typescript
const routeDepartures = await trpc.bus.getRouteDeparturesAtStop.query({
  routeNumericId: 1, // Route 1 (Glenwood)
  stopNumericId: 9115,
  date: new Date('2026-01-10'),
  limit: 5,
});
```

### 3. Get Full Trip Schedule

```typescript
const tripSchedule = await trpc.bus.getTripSchedule.query({
  tripId: "t1B3-b17D9-sl2B",
});
```

Response:
```typescript
{
  tripId: "t1B3-b17D9-sl2B",
  routeName: "Frontier",
  routeNumber: "31",
  headsign: "W.4 - W 12 - AIRPORT",
  directionId: 0,
  stops: [
    {
      stopId: 914,
      stopName: "E 10th St at French",
      latitude: 42.125996,
      longitude: -80.081619,
      arrivalTime: "10:15:00",
      departureTime: "10:15:00",
      sequence: 0,
      isTimepoint: false
    },
    // ... all stops for this trip
  ]
}
```

## Time Format

GTFS times are stored as strings in `HH:MM:SS` format. Times can exceed 24 hours (e.g., `25:30:00` = 1:30 AM next day) to represent trips that continue past midnight.

### Formatting Times

Use the `formatGTFSTime()` utility to convert GTFS times to readable format:

```typescript
import { formatGTFSTime } from '@/server/gtfs-schedule';

formatGTFSTime("10:30:00") // "10:30 AM"
formatGTFSTime("14:30:00") // "2:30 PM"
formatGTFSTime("25:30:00") // "1:30 AM (next day)"
```

## Service Dates

The GTFS data includes service dates from **January 10, 2026** to **June 6, 2026**.

Service IDs:
- **39**: Saturday service
- **43**: Weekday service (Monday-Friday)
- **45**: Sunday service

## Implementation Details

### Files Created

1. **`prisma/schema.prisma`** - Updated with new models
2. **`prisma/gtfs-parser.ts`** - CSV parsing utilities
3. **`prisma/seed-gtfs.ts`** - Import script
4. **`src/server/gtfs-schedule.ts`** - Query functions
5. **`src/server/api/routers/bus.ts`** - Updated with new endpoints

### Performance Considerations

- Indexed on `(stopId, departureTime)` for fast departure lookups
- Indexed on `(tripId, stopSequence)` for trip schedules
- Indexed on `(serviceId, date)` for active service lookups
- Batch inserts used during import (1000 records per batch)

### Timezone Handling

All dates are stored in UTC. When querying, dates are normalized to midnight UTC to match the stored service dates.

## Combining with Real-Time Data

The GTFS static schedule data complements the real-time API:

- **Static schedules** (GTFS): Official planned departure times
- **Real-time data** (Availtec API): Live vehicle positions and delays

You can combine both to show:
1. Scheduled departure time (from GTFS)
2. Real-time delays/predictions (from API)
3. Final predicted departure time

## Re-importing Data

To re-import (useful when GTFS data is updated):

```bash
# The script automatically clears old data before importing
bun run prisma/seed-gtfs.ts
```

This will:
- Delete existing trips and stop times
- Re-import all GTFS data
- Preserve existing routes and stops (merges data)

## Troubleshooting

### No departures found

Check:
1. The date has an active service (query `ServiceDate` table)
2. The stop exists with the correct `stopNumericId`
3. Trips are associated with active services

### Time filtering not working

Ensure time is in `HH:MM` format (24-hour):
- ✅ `"10:00"` (10:00 AM)
- ✅ `"14:30"` (2:30 PM)
- ❌ `"10:00 AM"` (invalid)

### Date issues

Remember to use UTC dates matching the stored format:
```typescript
// Correct
new Date('2026-01-10') // Will be normalized to UTC midnight

// May cause issues
new Date('1/10/2026') // Depends on local timezone
```
