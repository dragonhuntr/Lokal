"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { UserSafe } from "@/server/auth/types";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionResult {
  readonly user: UserSafe | null;
  readonly status: SessionStatus;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signUp: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly refetch: () => Promise<void>;
}

type MeResponse = { readonly user: UserSafe };

async function getMe(): Promise<UserSafe | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });

  if (res.ok) {
    const data = (await res.json()) as MeResponse;
    return data.user;
  }

  if (res.status === 401) return null;

  throw new Error("Failed to load session");
}

type AuthCredentials = Record<"email" | "password", string> & { name?: string };

const defaultHeaders: Readonly<Record<string, string>> = {
  "content-type": "application/json",
};

/**
 * Hook that exposes the authenticated user along with helpers to manage the
 * session lifecycle. The hook automatically attempts to refresh the session
 * when the initial fetch fails with an unauthenticated response.
 */
export function useSession(): SessionResult {
  const queryClient = useQueryClient();

  const { data, status, refetch } = useQuery<UserSafe | null>({
    queryKey: ["session", "me"],
    queryFn: async () => {
      const me = await getMe();
      if (me) return me;
      // try refresh once
      const refreshed = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (refreshed.ok) {
        return await getMe();
      }
      return null;
    },
  });

  const invalidateSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["session", "me"] });
  }, [queryClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Invalid email or password");
      }

      await invalidateSession();
    },
    [invalidateSession],
  );

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      const payload: AuthCredentials = { email, password };
      if (name) payload.name = name;

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to sign up");
      }

      await invalidateSession();
    },
    [invalidateSession],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await invalidateSession();
  }, [invalidateSession]);

  const refresh = useCallback(async () => {
    await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    await invalidateSession();
  }, [invalidateSession]);

  const sessionStatus: SessionStatus = useMemo(() => {
    if (status === "pending") return "loading";
    return data ? "authenticated" : "unauthenticated";
  }, [data, status]);

  return {
    user: data ?? null,
    status: sessionStatus,
    signIn,
    signUp,
    signOut,
    refresh,
    refetch: async () => {
      await refetch();
    },
  };
}


