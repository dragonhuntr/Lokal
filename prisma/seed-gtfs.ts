import { PrismaClient } from '@prisma/client';
import { join } from 'path';
import { parseGTFSDirectory, parseGTFSDate } from './gtfs-parser';

const prisma = new PrismaClient();

const GTFS_DIR = join(process.cwd(), 'google_transit');

async function main() {
  console.log('🚌 Starting GTFS data import...\n');

  // Parse all GTFS files
  console.log('📖 Parsing GTFS files...');
  const gtfs = parseGTFSDirectory(GTFS_DIR);

  console.log(`   ✓ Routes: ${gtfs.routes.length}`);
  console.log(`   ✓ Stops: ${gtfs.stops.length}`);
  console.log(`   ✓ Trips: ${gtfs.trips.length}`);
  console.log(`   ✓ Stop Times: ${gtfs.stopTimes.length}`);
  console.log(`   ✓ Calendar Dates: ${gtfs.calendarDates.length}\n`);

  // 1. Import Services and Calendar Dates
  console.log('📅 Importing services and calendar dates...');
  const serviceIds = new Set(gtfs.calendarDates.map(cd => parseInt(cd.service_id, 10)));

  for (const serviceId of serviceIds) {
    await prisma.service.upsert({
      where: { serviceId },
      update: {},
      create: {
        serviceId,
        name: `Service ${serviceId}`,
      },
    });
  }

  // Import calendar dates
  const calendarDateData = gtfs.calendarDates.map(cd => ({
    serviceId: parseInt(cd.service_id, 10),
    date: parseGTFSDate(cd.date),
    exceptionType: parseInt(cd.exception_type, 10),
  }));

  // Delete existing calendar dates to avoid duplicates
  await prisma.serviceDate.deleteMany({});

  // Batch insert calendar dates
  await prisma.serviceDate.createMany({
    data: calendarDateData,
    skipDuplicates: true,
  });

  console.log(`   ✓ Imported ${serviceIds.size} services`);
  console.log(`   ✓ Imported ${calendarDateData.length} calendar dates\n`);

  // 2. Update Routes (merge with existing data)
  console.log('🛣️  Updating routes...');
  let routesUpdated = 0;

  for (const gtfsRoute of gtfs.routes) {
    const routeNumericId = parseInt(gtfsRoute.route_id, 10);

    // Check if route already exists
    const existingRoute = await prisma.route.findUnique({
      where: { routeNumericId },
    });

    if (existingRoute) {
      // Update existing route with GTFS data if needed
      await prisma.route.update({
        where: { routeNumericId },
        data: {
          number: gtfsRoute.route_short_name || existingRoute.number,
          name: gtfsRoute.route_long_name || existingRoute.name,
        },
      });
      routesUpdated++;
    } else {
      // Create new route from GTFS
      await prisma.route.create({
        data: {
          routeNumericId,
          number: gtfsRoute.route_short_name,
          name: gtfsRoute.route_long_name,
          origin: '',
          destination: '',
          totalStops: 0,
          duration: 0,
        },
      });
      routesUpdated++;
    }
  }

  console.log(`   ✓ Updated ${routesUpdated} routes\n`);

  // 3. Import/Update Stops
  console.log('🚏 Importing stops...');
  let stopsProcessed = 0;

  for (const gtfsStop of gtfs.stops) {
    const stopNumericId = parseInt(gtfsStop.stop_id, 10);

    // Find existing stop with this numeric ID
    const existingStop = await prisma.stop.findFirst({
      where: { stopNumericId },
    });

    if (!existingStop) {
      // Need to create a standalone stop (not tied to a route yet)
      // We'll need to find the first route that uses this stop
      const stopTimeWithStop = gtfs.stopTimes.find(st => st.stop_id === gtfsStop.stop_id);
      if (stopTimeWithStop) {
        const trip = gtfs.trips.find(t => t.trip_id === stopTimeWithStop.trip_id);
        if (trip) {
          const route = await prisma.route.findUnique({
            where: { routeNumericId: parseInt(trip.route_id, 10) },
          });

          if (route) {
            await prisma.stop.create({
              data: {
                stopNumericId,
                name: gtfsStop.stop_name,
                latitude: parseFloat(gtfsStop.stop_lat),
                longitude: parseFloat(gtfsStop.stop_lon),
                sequence: parseInt(stopTimeWithStop.stop_sequence, 10),
                routeId: route.id,
              },
            });
            stopsProcessed++;
          }
        }
      }
    }
  }

  console.log(`   ✓ Processed ${stopsProcessed} new stops\n`);

  // 4. Import Trips
  console.log('🚌 Importing trips...');

  // Delete existing trips to avoid duplicates
  await prisma.trip.deleteMany({});

  const tripsData = [];
  for (const gtfsTrip of gtfs.trips) {
    const routeNumericId = parseInt(gtfsTrip.route_id, 10);
    const route = await prisma.route.findUnique({
      where: { routeNumericId },
    });

    if (route) {
      tripsData.push({
        gtfsTripId: gtfsTrip.trip_id,
        routeId: route.id,
        serviceId: parseInt(gtfsTrip.service_id, 10),
        directionId: parseInt(gtfsTrip.direction_id, 10),
        headsign: gtfsTrip.trip_headsign || '',
        shapeId: gtfsTrip.shape_id || null,
      });
    }
  }

  // Batch insert trips
  console.log(`   Processing ${tripsData.length} trips...`);
  const BATCH_SIZE = 500;
  for (let i = 0; i < tripsData.length; i += BATCH_SIZE) {
    const batch = tripsData.slice(i, i + BATCH_SIZE);
    await prisma.trip.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(`   ✓ Imported ${Math.min(i + BATCH_SIZE, tripsData.length)}/${tripsData.length} trips`);
  }

  console.log(`   ✓ Imported ${tripsData.length} trips\n`);

  // 5. Import Stop Times
  console.log('⏰ Importing stop times (this may take a while)...');

  // Delete existing stop times
  await prisma.stopTime.deleteMany({});

  // Build a map of gtfsTripId -> Trip.id for fast lookups
  const trips = await prisma.trip.findMany({
    select: { id: true, gtfsTripId: true },
  });
  const tripIdMap = new Map(trips.map(t => [t.gtfsTripId, t.id]));

  // Build a map of stopNumericId -> Stop.id for fast lookups
  const stops = await prisma.stop.findMany({
    where: { stopNumericId: { not: null } },
    select: { id: true, stopNumericId: true },
  });
  const stopIdMap = new Map(stops.map(s => [s.stopNumericId!, s.id]));

  const stopTimesData = [];
  let skipped = 0;

  for (const gtfsStopTime of gtfs.stopTimes) {
    const tripId = tripIdMap.get(gtfsStopTime.trip_id);
    const stopId = stopIdMap.get(parseInt(gtfsStopTime.stop_id, 10));

    if (tripId && stopId) {
      stopTimesData.push({
        tripId,
        stopId,
        arrivalTime: gtfsStopTime.arrival_time,
        departureTime: gtfsStopTime.departure_time,
        stopSequence: parseInt(gtfsStopTime.stop_sequence, 10),
        isTimepoint: gtfsStopTime.timepoint === '1',
      });
    } else {
      skipped++;
    }
  }

  // Batch insert stop times
  console.log(`   Processing ${stopTimesData.length} stop times...`);
  const STOP_TIME_BATCH_SIZE = 1000;
  for (let i = 0; i < stopTimesData.length; i += STOP_TIME_BATCH_SIZE) {
    const batch = stopTimesData.slice(i, i + STOP_TIME_BATCH_SIZE);
    await prisma.stopTime.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(`   ✓ Imported ${Math.min(i + STOP_TIME_BATCH_SIZE, stopTimesData.length)}/${stopTimesData.length} stop times`);
  }

  console.log(`   ✓ Imported ${stopTimesData.length} stop times`);
  if (skipped > 0) {
    console.log(`   ⚠️  Skipped ${skipped} stop times (missing trip or stop references)\n`);
  }

  console.log('✅ GTFS import completed successfully!\n');

  // Print summary
  const summary = await prisma.$transaction([
    prisma.service.count(),
    prisma.serviceDate.count(),
    prisma.route.count(),
    prisma.stop.count(),
    prisma.trip.count(),
    prisma.stopTime.count(),
  ]);

  console.log('📊 Database Summary:');
  console.log(`   Services: ${summary[0]}`);
  console.log(`   Service Dates: ${summary[1]}`);
  console.log(`   Routes: ${summary[2]}`);
  console.log(`   Stops: ${summary[3]}`);
  console.log(`   Trips: ${summary[4]}`);
  console.log(`   Stop Times: ${summary[5]}`);
}

main()
  .catch((e) => {
    console.error('❌ Error importing GTFS data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
