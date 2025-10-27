import { createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

import { env } from "@/env";
import { cookies } from "next/headers";

const scryptAsync = promisify(scrypt);

const JWT_SECRET: string = (() => {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT secret is not configured");
  }
  return secret;
})();

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export type TokenType = "access" | "refresh";

interface JwtClaims {
  sub: string;
  email: string;
  tokenType: TokenType;
  iat: number;
  exp: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const base64UrlEncode = (data: string | Buffer) =>
  Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (input: string) => {
  const pad = input.length % 4;
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad ? normalized + "====".slice(pad) : normalized;
  return Buffer.from(padded, "base64");
};

const signJwt = (
  payload: Omit<JwtClaims, "iat" | "exp">,
  expiresInSeconds: number
): string => {
  const header = { alg: "HS256", typ: "JWT" } as const;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSeconds;
  const claims: JwtClaims = { ...payload, iat, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", JWT_SECRET)
    .update(toSign)
    .digest();
  const encodedSignature = base64UrlEncode(signature);
  return `${toSign}.${encodedSignature}`;
};

export const verifyJwt = (token: string, expectedType?: TokenType): JwtClaims => {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("Invalid token structure");
  }

  const [encodedHeader, encodedPayload, signature] = segments as [
    string,
    string,
    string,
  ];
  const toSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = createHmac("sha256", JWT_SECRET)
    .update(toSign)
    .digest();
  const receivedSignature = base64UrlDecode(signature);

  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    throw new Error("Invalid token signature");
  }

  const payloadBuffer = base64UrlDecode(encodedPayload);
  const claims = JSON.parse(payloadBuffer.toString("utf8")) as JwtClaims;

  if (claims.exp * 1000 < Date.now()) {
    throw new Error("Token expired");
  }

  if (expectedType && claims.tokenType !== expectedType) {
    throw new Error("Unexpected token type");
  }

  return claims;
};

export const createTokenPair = (user: { id: string; email: string }): TokenPair => ({
  accessToken: signJwt(
    { sub: user.id, email: user.email, tokenType: "access" },
    ACCESS_TOKEN_TTL_SECONDS
  ),
  refreshToken: signJwt(
    { sub: user.id, email: user.email, tokenType: "refresh" },
    REFRESH_TOKEN_TTL_SECONDS
  ),
});

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
};

export const verifyPassword = async (
  password: string,
  stored: string
): Promise<boolean> => {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");
  return (
    derivedKey.length === storedKey.length &&
    timingSafeEqual(derivedKey, storedKey)
  );
};

export type { JwtClaims, TokenPair };

export const getClaimsFromCookies = async (): Promise<JwtClaims | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) return null;
    return verifyJwt(token, "access");
  } catch (_err) {
    return null;
  }
};

export const requireSelfOrThrow = (userId: string, claims: JwtClaims | null) => {
  if (!claims || claims.sub !== userId) {
    throw new Error("Unauthorized");
  }
};
