import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { getClaimsFromCookies, requireSelfOrThrow } from "@/server/auth/service";

type Context = { params: Promise<{ id: string }> };

// GET /api/user/[id]/saved-items - Get all saved items for a user
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(id, claims);

    const items = await db.savedItem.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const SaveItemSchema = z.discriminatedUnion("type", [
  // Journey type
  z.object({
    type: z.literal("JOURNEY"),
    nickname: z.string().trim().max(120).optional(),
    itineraryData: z.object({
      legs: z.array(z.any()),
      totalDistanceMeters: z.number(),
      totalDurationMinutes: z.number(),
      routeId: z.string().optional(),
      routeName: z.string().optional(),
      routeNumber: z.string().optional(),
      startStopId: z.string().optional(),
      endStopId: z.string().optional(),
    }),
    originLat: z.number(),
    originLng: z.number(),
    destinationName: z.string().trim().max(200).optional(),
  }),
  // Route type
  z.object({
    type: z.literal("ROUTE"),
    nickname: z.string().trim().max(120).optional(),
    routeId: z.string(),
  }),
]);

// POST /api/user/[id]/saved-items - Save a new item
export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(id, claims);

    const rawBody = (await request.json()) as unknown;
    const data = SaveItemSchema.parse(rawBody);

    let item;
    if (data.type === "JOURNEY") {
      item = await db.savedItem.create({
        data: {
          userId: id,
          type: "JOURNEY",
          nickname: data.nickname,
          itineraryData: data.itineraryData,
          originLat: data.originLat,
          originLng: data.originLng,
          destinationName: data.destinationName,
          totalDistance: data.itineraryData.totalDistanceMeters,
          totalDuration: data.itineraryData.totalDurationMinutes,
        },
      });
    } else {
      item = await db.savedItem.create({
        data: {
          userId: id,
          type: "ROUTE",
          nickname: data.nickname,
          routeId: data.routeId,
        },
      });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
