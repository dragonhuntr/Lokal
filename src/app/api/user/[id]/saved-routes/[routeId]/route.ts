import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { getClaimsFromCookies, requireSelfOrThrow } from "@/server/auth/service";

type Context = { params: { id: string; routeId: string } };

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(params.id, claims);

    await db.savedRoute.deleteMany({ where: { userId: params.id, routeId: params.routeId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}


