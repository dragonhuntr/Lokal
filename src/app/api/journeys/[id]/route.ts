import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { getClaimsFromCookies } from "@/server/auth/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();

    // Try to get the saved item
    const item = await db.savedItem.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        userId: true,
        nickname: true,
        itineraryData: true,
        destinationName: true,
        totalDistance: true,
        totalDuration: true,
        createdAt: true,
        routeId: true,
        originLat: true,
        originLng: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    // If authenticated and it's their own item, return full details (including routes)
    if (claims?.userId && item.userId === claims.userId) {
      if (item.type === "JOURNEY" && item.itineraryData) {
        return NextResponse.json({
          journey: {
            id: item.id,
            nickname: item.nickname,
            itineraryData: item.itineraryData,
            destinationName: item.destinationName,
            totalDistance: item.totalDistance,
            totalDuration: item.totalDuration,
            createdAt: item.createdAt,
          },
        });
      } else if (item.type === "ROUTE" && item.routeId) {
        // Return route data for authenticated users viewing their own saved routes
        return NextResponse.json({
          route: {
            id: item.id,
            routeId: item.routeId,
            nickname: item.nickname,
            createdAt: item.createdAt,
          },
        });
      }
    }

    // Public access: only allow journeys (not routes)
    if (item.type !== "JOURNEY" || !item.itineraryData) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    return NextResponse.json({
      journey: {
        id: item.id,
        nickname: item.nickname,
        itineraryData: item.itineraryData,
        destinationName: item.destinationName,
        totalDistance: item.totalDistance,
        totalDuration: item.totalDuration,
        createdAt: item.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to load journey", error);
    return NextResponse.json({ error: "Failed to load journey" }, { status: 500 });
  }
}
