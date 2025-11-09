import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { getClaimsFromCookies, requireSelfOrThrow } from "@/server/auth/service";

type Context = { params: Promise<{ id: string }> };

const PreferencesSchema = z.object({
  notificationsEnabled: z.boolean(),
});

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(id, claims);

    const rawBody = (await request.json()) as unknown;
    const { notificationsEnabled } = PreferencesSchema.parse(rawBody);

    const updated = await db.user.update({
      where: { id },
      data: { notificationsEnabled },
      select: { id: true, email: true, name: true, notificationsEnabled: true },
    });

    return NextResponse.json({ user: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
