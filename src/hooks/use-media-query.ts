"use client";

import { useEffect, useState } from "react";

/**
 * React hook that mirrors CSS media query matching on the client.
 * Falls back to `false` during SSR to avoid hydration mismatches.
 */
export function useMediaQuery(query: string) {
  const getInitialValue = () => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getInitialValue);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const updateMatch = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Sync with current value in case it changed between renders
    setMatches(mediaQueryList.matches);

    mediaQueryList.addEventListener("change", updateMatch);
    return () => mediaQueryList.removeEventListener("change", updateMatch);
  }, [query]);

  return matches;
}
