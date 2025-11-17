import { NextResponse } from "next/server";
import { z } from "zod";

import { planItineraries } from "@/server/routing/service";

const coordinateSchema = z.object({
  latitude: z.number().refine((value) => Math.abs(value) <= 90, "Latitude must be between -90 and 90"),
  longitude: z.number().refine((value) => Math.abs(value) <= 180, "Longitude must be between -180 and 180"),
  stopName: z.string().optional(),
  bufferMinutes: z.number().int().min(0).max(1440).optional(), // Max 24 hours buffer
  purpose: z.string().max(200).optional(),
});

const requestSchema = z
  .object({
    origin: coordinateSchema,
    destination: coordinateSchema.optional(),
    destinations: z.array(coordinateSchema).min(1).optional(),
    departureTime: z.string().datetime().optional(),
    maxWalkingDistanceMeters: z.number().positive().optional(),
    limit: z.number().int().positive().optional(),
  })
  .refine((value) => Boolean(value.destination) || Boolean(value.destinations?.length), {
    message: "At least one destination is required",
    path: ["destinations"],
  });

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = requestSchema.parse(json);

    // Validate departure time if provided
    let departureTime: Date | undefined;
    if (parsed.departureTime) {
      departureTime = new Date(parsed.departureTime);
      const now = new Date();
      const maxFutureDays = 7; // Allow planning up to 7 days in advance
      const maxFutureTime = new Date(now.getTime() + maxFutureDays * 24 * 60 * 60 * 1000);
      
      // Don't allow past times (allow 1 hour buffer for clock skew)
      const minTime = new Date(now.getTime() - 60 * 60 * 1000);
      
      if (departureTime.getTime() < minTime.getTime()) {
        return NextResponse.json(
          { error: "Departure time cannot be in the past" },
          { status: 400 }
        );
      }
      
      if (departureTime.getTime() > maxFutureTime.getTime()) {
        return NextResponse.json(
          { error: `Departure time cannot be more than ${maxFutureDays} days in the future` },
          { status: 400 }
        );
      }
    }

    const response = await planItineraries({
      origin: parsed.origin,
      destinations: parsed.destinations ?? (parsed.destination ? [parsed.destination] : undefined),
      maxWalkingDistanceMeters: parsed.maxWalkingDistanceMeters,
      limit: parsed.limit,
      departureTime,
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
