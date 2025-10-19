import { NextResponse } from "next/server";

import { env } from "@/env";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/server/auth/service";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function POST() {
  const response = NextResponse.json({ success: true });
  const secure = env.NODE_ENV === "production";

  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: "",
    maxAge: 0,
    secure,
    ...cookieOptions,
  });

  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: "",
    maxAge: 0,
    secure,
    ...cookieOptions,
  });

  return response;
}
