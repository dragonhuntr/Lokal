import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const directionId = searchParams.get("directionId");
    const dateParam = searchParams.get("date");

    // Find route by cuid or numeric ID
    let route = await db.route.findUnique({
      where: { id },
      select: { id: true, name: true, number: true, routeNumericId: true },
    });

    if (!route) {
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        route = await db.route.findUnique({
          where: { routeNumericId: numericId },
          select: { id: true, name: true, number: true, routeNumericId: true },
        });
      }
    }

    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    // Parse date or use today
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Find active services for the target date
    const activeServices = await db.serviceDate.findMany({
      where: {
        date: targetDate,
        exceptionType: 1, // 1 = service added/active
      },
      select: { serviceId: true },
    });

    const activeServiceIds = activeServices.map((s) => s.serviceId);

    // Build trip query
    const tripWhere: {
      routeId: string;
      serviceId?: { in: number[] };
      directionId?: number;
    } = {
      routeId: route.id,
    };

    // Only filter by service if we have active services for this date
    if (activeServiceIds.length > 0) {
      tripWhere.serviceId = { in: activeServiceIds };
    }

    if (directionId !== null && directionId !== undefined) {
      const dir = parseInt(directionId, 10);
      if (!isNaN(dir)) {
        tripWhere.directionId = dir;
      }
    }

    // Get trips with their stop times
    const trips = await db.trip.findMany({
      where: tripWhere,
      orderBy: { gtfsTripId: "asc" },
      include: {
        stopTimes: {
          orderBy: { stopSequence: "asc" },
          include: {
            stop: {
              select: {
                id: true,
                name: true,
                stopNumericId: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
    });

    // Sort trips by their first stop time
    const sortedTrips = trips.sort((a, b) => {
      const aTime = a.stopTimes[0]?.departureTime ?? "99:99:99";
      const bTime = b.stopTimes[0]?.departureTime ?? "99:99:99";
      return aTime.localeCompare(bTime);
    });

    const payload = {
      route: {
        id: route.id,
        name: route.name,
        number: route.number,
      },
      date: targetDate.toISOString().split("T")[0],
      activeServices: activeServiceIds,
      trips: sortedTrips.map((trip) => ({
        id: trip.id,
        headsign: trip.headsign,
        directionId: trip.directionId,
        serviceId: trip.serviceId,
        stopTimes: trip.stopTimes.map((st) => ({
          arrivalTime: st.arrivalTime,
          departureTime: st.departureTime,
          stopSequence: st.stopSequence,
          isTimepoint: st.isTimepoint,
          stop: {
            id: st.stop.id,
            stopNumericId: st.stop.stopNumericId,
            name: st.stop.name,
            latitude: st.stop.latitude,
            longitude: st.stop.longitude,
          },
        })),
      })),
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Failed to load route schedule from database", error);
    return NextResponse.json(
      { error: "Failed to load route schedule" },
      { status: 500 }
    );
  }
}
