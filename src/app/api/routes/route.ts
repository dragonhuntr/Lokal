import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/server/db";

export async function GET(_request: NextRequest) {
  try {
    const routes = await db.route.findMany({
      orderBy: { number: "asc" },
      include: {
        stops: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    const payload = routes.map((route) => ({
      id: route.id,
      name: route.name,
      number: route.number,
      origin: route.origin,
      destination: route.destination,
      totalStops: route.totalStops,
      duration: route.duration,
      stops: route.stops.map((stop) => ({
        id: stop.id,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        sequence: stop.sequence,
      })),
    }));

    return NextResponse.json({ routes: payload }, { status: 200 });
  } catch (error) {
    console.error("Failed to load routes from database", error);
    return NextResponse.json({ error: "Failed to load routes" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET" } });
}
