import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { getClaimsFromCookies, requireSelfOrThrow } from "@/server/auth/service";

type Context = { params: Promise<{ id: string; routeId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id, routeId } = await params;
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(id, claims);

    await db.savedRoute.deleteMany({ where: { userId: id, routeId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}


