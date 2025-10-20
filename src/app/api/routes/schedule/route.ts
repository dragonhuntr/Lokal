import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "GET /api/routes/schedule not implemented" },
    { status: 501 }
  );
}
