import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);

    // Try to find by cuid first, then by numeric ID
    let stop = await db.stop.findUnique({
      where: { id },
      include: {
        route: {
          select: {
            id: true,
            name: true,
            number: true,
          },
        },
      },
    });

    // If not found, try finding by numeric ID
    if (!stop) {
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        stop = await db.stop.findFirst({
          where: { stopNumericId: numericId },
          include: {
            route: {
              select: {
                id: true,
                name: true,
                number: true,
              },
            },
          },
        });
      }
    }

    if (!stop) {
      return NextResponse.json({ error: "Stop not found" }, { status: 404 });
    }

    // Get upcoming departures for this stop
    // Since GTFS times are stored as strings like "14:30:00", we need to filter appropriately
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:00`;

    const upcomingStopTimes = await db.stopTime.findMany({
      where: {
        stopId: stop.id,
        departureTime: {
          gte: currentTime,
        },
      },
      orderBy: { departureTime: "asc" },
      take: limit,
      include: {
        trip: {
          select: {
            id: true,
            headsign: true,
            directionId: true,
            route: {
              select: {
                id: true,
                name: true,
                number: true,
              },
            },
          },
        },
      },
    });

    const payload = {
      id: stop.id,
      stopNumericId: stop.stopNumericId,
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      sequence: stop.sequence,
      route: {
        id: stop.route.id,
        name: stop.route.name,
        number: stop.route.number,
      },
      upcomingDepartures: upcomingStopTimes.map((st) => ({
        departureTime: st.departureTime,
        arrivalTime: st.arrivalTime,
        headsign: st.trip.headsign,
        directionId: st.trip.directionId,
        route: {
          id: st.trip.route.id,
          name: st.trip.route.name,
          number: st.trip.route.number,
        },
      })),
    };

    return NextResponse.json(
      { stop: payload },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Failed to load stop from database", error);
    return NextResponse.json({ error: "Failed to load stop" }, { status: 500 });
  }
}

export async function PUT(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(
    { message: `PUT /api/stops/${id} not implemented` },
    { status: 501 }
  );
}
