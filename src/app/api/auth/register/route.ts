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
  hashPassword,
} from "@/server/auth/service";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .max(120)
    .optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as unknown;
    const { email, password, name } = RegisterSchema.parse(rawBody);

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with that email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { email, password: passwordHash, name },
    });

    const tokens = createTokenPair(user);
    const response = NextResponse.json(
      {
        user: { id: user.id, email: user.email, name: user.name },
        accessToken: tokens.accessToken,
      },
      { status: 201 }
    );

    const secure = env.NODE_ENV === "production";
    response.cookies.set({
      name: ACCESS_TOKEN_COOKIE,
      value: tokens.accessToken,
      httpOnly: true,
      sameSite: "lax",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
      secure,
      path: "/",
    });
    response.cookies.set({
      name: REFRESH_TOKEN_COOKIE,
      value: tokens.refreshToken,
      httpOnly: true,
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
      secure,
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    console.error("Error registering user:", error);
    return NextResponse.json(
      { error: "Unable to register user." },
      { status: 500 }
    );
  }
}
