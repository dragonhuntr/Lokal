"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { UserSafe } from "@/server/auth/types";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionResult {
  user: UserSafe | null;
  status: SessionStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  refetch: () => Promise<void>;
}

async function getMe(): Promise<UserSafe | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.ok) {
    const data = (await res.json()) as { user: UserSafe };
    return data.user;
  }
  if (res.status === 401) return null;
  throw new Error("Failed to load session");
}

export function useSession(): SessionResult {
  const queryClient = useQueryClient();

  const { data, status, refetch } = useQuery({
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

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Invalid email or password");
    await queryClient.invalidateQueries({ queryKey: ["session", "me"] });
  }, [queryClient]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to sign up");
    await queryClient.invalidateQueries({ queryKey: ["session", "me"] });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await queryClient.invalidateQueries({ queryKey: ["session", "me"] });
  }, [queryClient]);

  const refresh = useCallback(async () => {
    await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    await queryClient.invalidateQueries({ queryKey: ["session", "me"] });
  }, [queryClient]);

  return {
    user: data ?? null,
    status: status === "loading" ? "loading" : data ? "authenticated" : "unauthenticated",
    signIn,
    signUp,
    signOut,
    refresh,
    refetch: async () => { await refetch(); },
  };
}


