import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/env";
import { db } from "@/server/db";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  createTokenPair,
  verifyPassword,
} from "@/server/auth/service";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as unknown;
    const { email, password } = LoginSchema.parse(rawBody);

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Error logging in user:", error);
    return NextResponse.json(
      { error: "Unable to complete login request." },
      { status: 500 }
    );
  }
}
