import { NextResponse } from "next/server";
import { z } from "zod";

import { planItineraries } from "@/server/routing/service";

const coordinateSchema = z.object({
  latitude: z.number().refine((value) => Math.abs(value) <= 90, "Latitude must be between -90 and 90"),
  longitude: z.number().refine((value) => Math.abs(value) <= 180, "Longitude must be between -180 and 180"),
});

const requestSchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  departureTime: z.string().datetime().optional(),
  maxWalkingDistanceMeters: z.number().positive().optional(),
  limit: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = requestSchema.parse(json);

    const response = await planItineraries({
      origin: parsed.origin,
      destination: parsed.destination,
      maxWalkingDistanceMeters: parsed.maxWalkingDistanceMeters,
      limit: parsed.limit,
      departureTime: parsed.departureTime ? new Date(parsed.departureTime) : undefined,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request payload", issues: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to plan directions", error);
    return NextResponse.json(
      { error: "Failed to plan directions" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}
