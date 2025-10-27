import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { getClaimsFromCookies, requireSelfOrThrow } from "@/server/auth/service";

type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  try {
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(params.id, claims);

    const saved = await db.savedRoute.findMany({
      where: { userId: params.id },
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
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(params.id, claims);

    const body = await request.json();
    const { routeId, nickname } = SaveSchema.parse(body);

    const existing = await db.savedRoute.findFirst({ where: { userId: params.id, routeId } });
    if (existing) {
      return NextResponse.json({ savedRoute: existing }, { status: 200 });
    }

    // Ensure route exists
    const route = await db.route.findUnique({ where: { id: routeId } });
    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    const created = await db.savedRoute.create({
      data: { userId: params.id, routeId, nickname },
    });

    return NextResponse.json({ savedRoute: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}


