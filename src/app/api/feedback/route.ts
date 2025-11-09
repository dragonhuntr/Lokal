import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getClaimsFromCookies } from "@/server/auth/service";

const CreateFeedbackSchema = z.object({
  userId: z.string().min(1),
  routeId: z.string().optional(),
  stopId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
}).refine((data) => data.routeId ?? data.stopId, {
  message: "Either routeId or stopId must be provided",
});

export async function POST(request: Request) {
  try {
    const claims = await getClaimsFromCookies();
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = (await request.json()) as unknown;
    const data = CreateFeedbackSchema.parse(rawBody);

    if (data.userId !== claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const feedback = await db.feedback.create({
      data: {
        userId: data.userId,
        routeId: data.routeId,
        stopId: data.stopId,
        rating: data.rating,
        comment: data.comment,
      },
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to create feedback", error);
    return NextResponse.json({ error: "Failed to create feedback" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get("routeId");
    const stopId = searchParams.get("stopId");

    if (!routeId && !stopId) {
      return NextResponse.json(
        { error: "Either routeId or stopId must be provided" },
        { status: 400 }
      );
    }

    const where = routeId ? { routeId } : { stopId: stopId! };

    const feedbacks = await db.feedback.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate average rating
    const avgRating =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
        : 0;

    return NextResponse.json({
      feedbacks: feedbacks.map((f) => ({
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        createdAt: f.createdAt,
        userName: f.user.name ?? "Anonymous",
      })),
      averageRating: Math.round(avgRating * 10) / 10,
      totalCount: feedbacks.length,
    });
  } catch (error) {
    console.error("Failed to fetch feedback", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}
