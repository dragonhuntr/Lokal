import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/env";
import { db } from "@/server/db";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  createTokenPair,
  verifyJwt,
} from "@/server/auth/service";

const RefreshSchema = z
  .object({ refreshToken: z.string().min(1) })
  .partial()
  .optional();

const extractRefreshToken = async (request: NextRequest) => {
  const fromCookie = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return fromCookie;
    }
    const parsed = RefreshSchema.safeParse(body);
    if (parsed.success && parsed.data?.refreshToken) {
      return parsed.data.refreshToken;
    }
  } catch (error) {
    // ignore JSON parse errors and rely on cookie value
  }

  return fromCookie;
};

export async function POST(request: NextRequest) {
  try {
    const refreshToken = await extractRefreshToken(request);
    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token missing." },
        { status: 401 }
      );
    }

    const claims = verifyJwt(refreshToken, "refresh");
    const user = await db.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 401 });
    }

    const tokens = createTokenPair(user);
    const response = NextResponse.json(
      {
        user: { id: user.id, email: user.email, name: user.name },
        accessToken: tokens.accessToken,
      },
      { status: 200 }
    );

    const secure = env.NODE_ENV === "production";
    response.cookies.set({
      name: ACCESS_TOKEN_COOKIE,
      value: tokens.accessToken,
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
      path: "/",
    });
    response.cookies.set({
      name: REFRESH_TOKEN_COOKIE,
      value: tokens.refreshToken,
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error refreshing auth token:", error);
    return NextResponse.json(
      { error: "Unable to refresh authentication token." },
      { status: 401 }
    );
  }
}
