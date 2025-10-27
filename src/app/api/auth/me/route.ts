import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { getClaimsFromCookies } from "@/server/auth/service";

export async function GET() {
  try {
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, name: true, notificationsEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("Error getting current user:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}


