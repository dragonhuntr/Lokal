import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(
    { message: `GET /api/bus/${id} not implemented` },
    { status: 501 }
  );
}
