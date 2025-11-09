import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(
    { message: `GET /api/stops/${id} not implemented` },
    { status: 501 }
  );
}

export async function PUT(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(
    { message: `PUT /api/stops/${id} not implemented` },
    { status: 501 }
  );
}
