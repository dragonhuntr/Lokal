import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getClaimsFromCookies } from "@/server/auth/service";

type Context = { params: Promise<{ id: string }> };

const UpdateTripSchema = z.object({
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELED"]).optional(),
  departureTime: z.string().datetime().optional(),
  arrivalTime: z.string().datetime().optional(),
  isRecurring: z.boolean().optional(),
  frequency: z.string().optional(),
});

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await db.trip.findUnique({
      where: { id },
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
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.userId !== claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ trip });
  } catch (error) {
    console.error("Failed to fetch trip", error);
    return NextResponse.json({ error: "Failed to fetch trip" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingTrip = await db.trip.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingTrip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (existingTrip.userId !== claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = (await request.json()) as unknown;
    const data = UpdateTripSchema.parse(rawBody);

    const trip = await db.trip.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.departureTime && { departureTime: new Date(data.departureTime) }),
        ...(data.arrivalTime && { arrivalTime: new Date(data.arrivalTime) }),
        ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
        ...(data.frequency !== undefined && { frequency: data.frequency }),
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

    return NextResponse.json({ trip });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to update trip", error);
    return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingTrip = await db.trip.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingTrip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (existingTrip.userId !== claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.trip.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete trip", error);
    return NextResponse.json({ error: "Failed to delete trip" }, { status: 500 });
  }
}
