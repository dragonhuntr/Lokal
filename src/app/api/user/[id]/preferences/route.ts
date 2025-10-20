import { NextResponse } from "next/server";

type Context = { params: { id: string } };

export async function PUT(_request: Request, { params }: Context) {
  return NextResponse.json(
    { message: `PUT /api/user/${params.id}/preferences not implemented` },
    { status: 501 }
  );
}
