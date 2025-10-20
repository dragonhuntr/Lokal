import { NextResponse } from "next/server";

import { openApiDocument } from "@/server/docs/openapi";

export async function GET() {
  return NextResponse.json(openApiDocument, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
