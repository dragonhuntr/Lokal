import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getClaimsFromCookies } from "@/server/auth/service";

const CreateTripSchema = z.object({
  userId: z.string().min(1),
  routeId: z.string().min(1),
  startStopId: z.string().optional(),
  endStopId: z.string().optional(),
  isRecurring: z.boolean().default(false),
  frequency: z.string().optional(),
  departureTime: z.string().datetime(),
  arrivalTime: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  try {
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId || userId !== claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trips = await db.trip.findMany({
      where: { userId },
      include: {
        route: {
          select: {
            id: true,
            name: true,
            number: true,
            origin: true,
            destination: true,
          },
        },
        startStop: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
        endStop: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ trips });
  } catch (error) {
    console.error("Failed to fetch trips", error);
    return NextResponse.json({ error: "Failed to fetch trips" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = (await request.json()) as unknown;
    const data = CreateTripSchema.parse(rawBody);

    if (data.userId !== claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await db.trip.create({
      data: {
        userId: data.userId,
        routeId: data.routeId,
        startStopId: data.startStopId,
        endStopId: data.endStopId,
        isRecurring: data.isRecurring,
        frequency: data.frequency,
        departureTime: new Date(data.departureTime),
        arrivalTime: data.arrivalTime ? new Date(data.arrivalTime) : null,
        status: "PLANNED",
      },
      include: {
        route: {
          select: {
            id: true,
            name: true,
            number: true,
            origin: true,
            destination: true,
          },
        },
      },
    });

    return NextResponse.json({ trip }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to create trip", error);
    return NextResponse.json({ error: "Failed to create trip" }, { status: 500 });
  }
}
