import { NextResponse } from "next/server";

import { db } from "@/server/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;

    const route = await db.route.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        number: true,
        origin: true,
        destination: true,
        totalStops: true,
        duration: true,
        stops: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            sequence: true,
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    return NextResponse.json({ route }, { status: 200 });
  } catch (error) {
    console.error("Failed to load route from database", error);
    return NextResponse.json({ error: "Failed to load route" }, { status: 500 });
  }
}
