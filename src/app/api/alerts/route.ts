import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getClaimsFromCookies } from "@/server/auth/service";

const CreateAlertSchema = z.object({
  userId: z.string().min(1),
  tripId: z.string().optional(),
  type: z.enum(["DEPARTURE_REMINDER", "TRANSFER_ALERT", "ARRIVAL_ALERT", "SERVICE_UPDATE"]),
  message: z.string().min(1),
  sendAt: z.string().datetime(),
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

    const alerts = await db.alert.findMany({
      where: { userId },
      include: {
        trip: {
          select: {
            id: true,
            routeId: true,
            departureTime: true,
            status: true,
            route: {
              select: {
                name: true,
                number: true,
              },
            },
          },
        },
      },
      orderBy: { sendAt: "asc" },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Failed to fetch alerts", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = (await request.json()) as unknown;
    const data = CreateAlertSchema.parse(rawBody);

    if (data.userId !== claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const alert = await db.alert.create({
      data: {
        userId: data.userId,
        tripId: data.tripId,
        type: data.type,
        message: data.message,
        sendAt: new Date(data.sendAt),
        isSent: false,
      },
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to create alert", error);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}
