import { NextResponse } from "next/server";

type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  return NextResponse.json(
    { message: `GET /api/user/${params.id} not implemented` },
    { status: 501 }
  );
}

export async function PUT(_request: Request, { params }: Context) {
  return NextResponse.json(
    { message: `PUT /api/user/${params.id} not implemented` },
    { status: 501 }
  );
}

export async function DELETE(_request: Request, { params }: Context) {
  return NextResponse.json(
    { message: `DELETE /api/user/${params.id} not implemented` },
    { status: 501 }
  );
}
