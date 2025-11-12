import { NextResponse } from "next/server";

import { db } from "@/server/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;

    const journey = await db.savedItem.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        nickname: true,
        itineraryData: true,
        destinationName: true,
        totalDistance: true,
        totalDuration: true,
        createdAt: true,
      },
    });

    if (!journey || journey.type !== "JOURNEY" || !journey.itineraryData) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    return NextResponse.json({
      journey: {
        id: journey.id,
        nickname: journey.nickname,
        itineraryData: journey.itineraryData,
        destinationName: journey.destinationName,
        totalDistance: journey.totalDistance,
        totalDuration: journey.totalDuration,
        createdAt: journey.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to load shared journey", error);
    return NextResponse.json({ error: "Failed to load journey" }, { status: 500 });
  }
}
