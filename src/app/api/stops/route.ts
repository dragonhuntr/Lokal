import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const search = searchParams.get("search");

    const where = search
      ? {
          name: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {};

    const [stops, total] = await Promise.all([
      db.stop.findMany({
        where,
        orderBy: { name: "asc" },
        skip: offset,
        take: limit,
        include: {
          route: {
            select: {
              id: true,
              name: true,
              number: true,
            },
          },
        },
      }),
      db.stop.count({ where }),
    ]);

    const payload = stops.map((stop) => ({
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
    }));

    return NextResponse.json(
      {
        stops: payload,
        total,
        limit,
        offset,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Failed to load stops from database", error);
    return NextResponse.json(
      { error: "Failed to load stops" },
      { status: 500 }
    );
  }
}
