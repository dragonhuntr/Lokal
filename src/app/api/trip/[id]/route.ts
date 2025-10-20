import { NextResponse } from "next/server";

type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  return NextResponse.json(
    { message: `GET /api/trip/${params.id} not implemented` },
    { status: 501 }
  );
}

export async function POST(_request: Request, { params }: Context) {
  return NextResponse.json(
    { message: `POST /api/trip/${params.id} not implemented` },
    { status: 501 }
  );
}

export async function PUT(_request: Request, { params }: Context) {
  return NextResponse.json(
    { message: `PUT /api/trip/${params.id} not implemented` },
    { status: 501 }
  );
}

export async function DELETE(_request: Request, { params }: Context) {
  return NextResponse.json(
    { message: `DELETE /api/trip/${params.id} not implemented` },
    { status: 501 }
  );
}
