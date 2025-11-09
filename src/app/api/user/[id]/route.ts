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

    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, notificationsEnabled: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const UpdateUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const claims = await getClaimsFromCookies();
    requireSelfOrThrow(id, claims);

    const rawBody = (await request.json()) as unknown;
    const { name } = UpdateUserSchema.parse(rawBody);

    const updated = await db.user.update({
      where: { id },
      data: { name },
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

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(
    { message: `DELETE /api/user/${id} not implemented` },
    { status: 501 }
  );
}
