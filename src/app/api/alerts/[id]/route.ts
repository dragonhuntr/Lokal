import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getClaimsFromCookies } from "@/server/auth/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const alert = await db.alert.findUnique({
      where: { id },
      include: {
        trip: {
          select: {
            id: true,
            routeId: true,
            departureTime: true,
            route: {
              select: {
                name: true,
                number: true,
              },
            },
          },
        },
      },
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    if (alert.userId !== claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ alert });
  } catch (error) {
    console.error("Failed to fetch alert", error);
    return NextResponse.json({ error: "Failed to fetch alert" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingAlert = await db.alert.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingAlert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    if (existingAlert.userId !== claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.alert.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete alert", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
