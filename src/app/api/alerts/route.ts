import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "GET /api/alerts not implemented" },
    { status: 501 }
  );
}

export async function POST() {
  return NextResponse.json(
    { message: "POST /api/alerts not implemented" },
    { status: 501 }
  );
}
