import { NextResponse } from "next/server";

type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  return NextResponse.json(
    { message: `GET /api/bus/${params.id} not implemented` },
    { status: 501 }
  );
}
