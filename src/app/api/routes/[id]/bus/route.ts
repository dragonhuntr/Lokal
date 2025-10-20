import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/server/db";

type Context = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Route id is required" }, { status: 400 });
  }

  try {
    const route = await db.route.findUnique({
      where: { id },
      include: {
        stops: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ error: `Route ${id} not found` }, { status: 404 });
    }

    const data = {
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
    };

    return NextResponse.json({ route: data }, { status: 200 });
  } catch (error) {
    console.error(`Failed to load bus info for route ${id}`, error);
    return NextResponse.json({ error: "Failed to load route information" }, { status: 500 });
  }
}
