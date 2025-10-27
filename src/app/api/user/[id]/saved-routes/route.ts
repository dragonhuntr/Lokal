import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { getClaimsFromCookies, requireSelfOrThrow } from "@/server/auth/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(id, claims);

    const saved = await db.savedRoute.findMany({
      where: { userId: id },
      include: {
        route: {
          select: {
            id: true,
            name: true,
            number: true,
            origin: true,
            destination: true,
            totalStops: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      savedRoutes: saved.map((s) => ({
        id: s.id,
        routeId: s.routeId,
        nickname: s.nickname,
        createdAt: s.createdAt,
        route: s.route,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const SaveSchema = z.object({
  routeId: z.string().min(1),
  nickname: z.string().trim().max(120).optional(),
});

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(id, claims);

    const body = await request.json();
    const { routeId, nickname } = SaveSchema.parse(body);

    const existing = await db.savedRoute.findFirst({ where: { userId: id, routeId } });
    if (existing) {
      return NextResponse.json({ savedRoute: existing }, { status: 200 });
    }

    // Check if route exists, if not and it's a walking route, create it
    let route = await db.route.findUnique({ where: { id: routeId } });
    
    if (!route) {
      // If it's a walking route (starts with "walk-"), create it
      if (routeId.startsWith("walk-")) {
        route = await db.route.create({
          data: {
            id: routeId,
            name: "Walking Route",
            number: "Walk",
            origin: "Your Location",
            destination: "Destination",
            totalStops: 0,
            duration: 0,
          },
        });
      } else {
        return NextResponse.json({ error: "Route not found" }, { status: 404 });
      }
    }

    const created = await db.savedRoute.create({
      data: { userId: id, routeId, nickname },
    });

    return NextResponse.json({ savedRoute: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}


