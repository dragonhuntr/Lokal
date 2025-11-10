import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { getClaimsFromCookies, requireSelfOrThrow } from "@/server/auth/service";

type Context = { params: Promise<{ id: string; itemId: string }> };

// GET /api/user/[id]/saved-items/[itemId] - Get a specific saved item
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id, itemId } = await params;
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(id, claims);

    const item = await db.savedItem.findFirst({
      where: {
        id: itemId,
        userId: id,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// DELETE /api/user/[id]/saved-items/[itemId] - Delete a saved item
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id, itemId } = await params;
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(id, claims);

    const item = await db.savedItem.findFirst({
      where: {
        id: itemId,
        userId: id,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await db.savedItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
